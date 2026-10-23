import fs from 'node:fs'
import path from 'node:path'

import { parseDocument } from 'yaml'

import type { Registered } from './apps.types'
import { appOf, loadApp, parseRegistration, resolveApp, slug } from './config'
import type { RigConfig } from './config.types'

/** An app id with no registration in the Muster home. */
export class NotRegistered extends Error {
  constructor(readonly id: string) {
    super(`${id} is not registered: run muster register <file>`)
  }
}

/** The folder of registrations, one `<id>.yaml` per app. */
const appsDir = (home: string): string => path.join(home, 'apps')

/** The registration file of app `id`. */
const registrationFile = (home: string, id: string): string =>
  path.join(appsDir(home), `${id}.yaml`)

/** Every registered app, by id. */
export const registered = (home: string): Registered[] => {
  let names: string[]
  try {
    names = fs.readdirSync(appsDir(home))
  } catch {
    return []
  }
  return names
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => ({ id: name.slice(0, -'.yaml'.length), file: path.join(appsDir(home), name) }))
}

/**
 * App `id` as a launch from `checkout` runs it. Throws NotRegistered, also for an id that is no
 * slug and so could name a file outside the registrations, or a ConfigError.
 */
export const openApp = (home: string, id: string, checkout?: string): RigConfig => {
  const file = registrationFile(home, id)
  if (slug(id) !== id || !fs.existsSync(file)) throw new NotRegistered(id)
  return loadApp(file, { home, ...(checkout === undefined ? {} : { checkout }) })
}

/**
 * Validates the registration `text`, read from `file`, with the recipe its checkout holds and the
 * one it pins, then stores it under its id with `repo` made absolute, so it no longer depends on
 * where it was written. Throws a ConfigError listing every problem; nothing is stored then.
 */
export const register = (text: string, file: string, home: string): RigConfig => {
  const registration = parseRegistration(text, path.resolve(file), home)
  const config = appOf(registration)
  if (registration.pinned !== null) resolveApp(registration, null)
  const document = parseDocument(text, { merge: true })
  document.set('repo', registration.repo)
  const target = registrationFile(home, registration.id)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, document.toString())
  return config
}
