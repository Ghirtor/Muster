import fs from 'node:fs'

import { register, registered } from '../engine/apps'
import {
  appOf,
  ConfigError,
  parseRegistration,
  readRegistration,
  recipeFile,
  resolveApp,
  runsPinned
} from '../engine/config'
import type { Registration, RigConfig } from '../engine/config.types'
import { Rig } from '../engine/rig'
import type { AppEntry, Validation } from './registry.types'

/** Runs `load`, keeping a ConfigError's problems instead of throwing them. */
const attempt = (load: () => RigConfig): Validation => {
  try {
    return { ok: true, config: load() }
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, problems: error.problems }
    throw error
  }
}

/** The text of `file`, or null when it cannot be read. */
const readText = (file: string): string | null => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/**
 * App `id`, registered at `registration`, with the file the Config screen edits: the checkout's
 * recipe, else the registration when it pins the recipe or does not parse. An app that does not
 * load keeps its problems.
 */
const loadEntry = (id: string, registration: string, home: string): AppEntry => {
  const broken = (file: string, problems: string[]): AppEntry => ({
    id,
    file,
    registration,
    config: null,
    problems
  })
  let parsed: Registration
  try {
    parsed = readRegistration(registration, home)
  } catch (error) {
    if (error instanceof ConfigError) return broken(registration, error.problems)
    throw error
  }
  const file = runsPinned(parsed) ? registration : recipeFile(parsed)
  const result = attempt(() => appOf(parsed))
  return result.ok
    ? { id, file, registration, config: result.config, problems: null }
    : broken(file, result.problems)
}

/**
 * The apps registered in the Muster home, one registration file each, under the id it was
 * registered as. An app that does not load stays listed with its problems, so the dashboard can
 * show what to fix.
 */
export class Registry {
  private entries: AppEntry[] = []

  constructor(readonly home: string) {
    this.reload()
  }

  /** Reads every registration and recipe again. */
  reload(): void {
    this.entries = registered(this.home).map(({ id, file }) => loadEntry(id, file, this.home))
  }

  /** Every app, by id. */
  list(): AppEntry[] {
    return this.entries
  }

  /** The app with `id`, or null. */
  get(id: string): AppEntry | null {
    return this.entries.find((entry) => entry.id === id) ?? null
  }

  /** A rig over the app's own checkout that prints nothing, for reading its state. */
  rigOf(entry: AppEntry & { problems: null }): Rig {
    return new Rig(entry.config, {
      repo: entry.config.repo,
      reason: '',
      wait: false,
      force: false,
      out: { write: () => undefined }
    })
  }

  /** The edited file's text as it is on disk; empty when the recipe is not written yet. */
  text(entry: AppEntry): string {
    return readText(entry.file) ?? ''
  }

  /**
   * The app `text` would make as the new content of the entry's edited file. A registration may
   * not change the id, which names the stored file and the default lock.
   */
  validate(entry: Pick<AppEntry, 'id' | 'file' | 'registration'>, text: string): Validation {
    return attempt(() => {
      if (entry.file !== entry.registration) {
        const registration = readRegistration(entry.registration, this.home)
        return resolveApp(registration, { text, file: entry.file })
      }
      const registration = parseRegistration(text, entry.file, this.home)
      if (registration.id !== entry.id) {
        throw new ConfigError(entry.file, [
          `id: ${registration.id} is not ${entry.id}'s id; register it as another app instead`
        ])
      }
      return appOf(registration)
    })
  }

  /** Writes `text` over the entry's edited file when it is valid, and reloads every app. */
  save(entry: AppEntry, text: string): Validation {
    const result = this.validate(entry, text)
    if (!result.ok) return result
    fs.writeFileSync(entry.file, text)
    this.reload()
    return result
  }

  /** Registers the app in `text`, read from `file`, as `muster register` does, and reloads. */
  register(text: string, file: string): Validation {
    const result = attempt(() => register(text, file, this.home))
    if (result.ok) this.reload()
    return result
  }
}
