import fs from 'node:fs'
import path from 'node:path'

import { ConfigError, parseConfig, slug } from '../engine/config'
import { Rig } from '../engine/rig'
import type { AppEntry, Validation } from './registry.types'

/** Parses `text` as the config in `file`, keeping the problems instead of throwing them. */
export const validate = (text: string, file: string): Validation => {
  try {
    return { ok: true, config: parseConfig(text, file) }
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
 * The apps the supervisor knows: one config file each. A config that does not load stays listed
 * with its problems, so the dashboard can show what to fix. An app's id is its name made into a
 * slug, numbered when two configs share a name.
 */
export class Registry {
  private entries: AppEntry[] = []

  constructor(private readonly files: string[]) {
    this.reload()
  }

  /** Reads every config file again. */
  reload(): void {
    const taken = new Set<string>()
    this.entries = this.files.map((given) => {
      const file = path.resolve(given)
      const text = readText(file)
      const result: Validation =
        text === null ? { ok: false, problems: [`cannot read ${file}`] } : validate(text, file)
      const base = slug(result.ok ? result.config.name : path.parse(file).name)
      let id = base
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
      taken.add(id)
      return result.ok
        ? { id, file, config: result.config, problems: null }
        : { id, file, config: null, problems: result.problems }
    })
  }

  /** Every app, in the order its file was given. */
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

  /** The config file's text as it is on disk. */
  text(entry: AppEntry): string {
    return readText(entry.file) ?? ''
  }

  /** Writes `text` over the app's config when it is valid, and reloads every app. */
  save(entry: AppEntry, text: string): Validation {
    const result = validate(text, entry.file)
    if (!result.ok) return result
    fs.writeFileSync(entry.file, text)
    this.reload()
    return result
  }
}
