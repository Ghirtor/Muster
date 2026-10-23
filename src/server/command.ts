import fs from 'node:fs'
import path from 'node:path'

import type { CommandIo, Flags } from './command.types'
import { NotRegistered, openApp, register, registered } from './engine/apps'
import { ConfigError, musterHome, readRegistration, recipeFile, runsPinned } from './engine/config'
import { Rig } from './engine/rig'
import type { Outcome } from './engine/rig.types'

export const USAGE = [
  'usage: muster [status|up|release|down] --app <id> [--repo <path>] [--reason <text>] [--wait] [--force]',
  '       muster register <file>',
  '       muster apps'
].join('\n')

export const EXIT = { ok: 0, failed: 1, usage: 2, busy: 3 } as const

const RIG_COMMANDS = new Set(['status', 'up', 'release', 'down'])

/** `--name value` and bare `--name` pairs, as rig.mjs reads them; anything else is ignored. */
export const parseFlags = (argv: string[]): Flags => {
  const flags: Flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv.at(i) ?? ''
    if (!arg.startsWith('--')) continue
    const next = argv.at(i + 1)
    if (next !== undefined && !next.startsWith('--')) {
      flags[arg.slice(2)] = next
      i++
    } else {
      flags[arg.slice(2)] = true
    }
  }
  return flags
}

/** The flag's text, or `fallback` when it is missing or given without a value. */
const text = (flags: Flags, name: string, fallback: string): string => {
  const value = flags[name]
  return typeof value === 'string' ? value : fallback
}

/** The exit code an outcome maps to: rig.mjs's, so the rig-ctl skill reads them unchanged. */
export const exitCode = (outcome: Outcome): number => {
  if (outcome.ok) return EXIT.ok
  return outcome.busy ? EXIT.busy : EXIT.failed
}

/** Validates and stores the registration in `file`; every problem is printed when it is refused. */
const runRegister = (file: string | undefined, io: CommandIo): number => {
  if (file === undefined || file.startsWith('--')) {
    io.err.write(`${USAGE}\n`)
    return EXIT.usage
  }
  const source = path.resolve(io.cwd, file)
  try {
    const config = register(fs.readFileSync(source, 'utf8'), source, musterHome(io.env))
    const recipe = config.recipe.pinned ? 'pinned in the registration' : config.recipe.file
    io.out.write(`registered ${config.id}\n  repo: ${config.repo}\n  recipe: ${recipe}\n`)
    return EXIT.ok
  } catch (error) {
    if (error instanceof ConfigError) io.err.write(`${error.message}\n`)
    else io.err.write(`${source}: ${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT.usage
  }
}

/** Lists the registered apps: id, name, checkout and where its recipe comes from. */
const runApps = (io: CommandIo): number => {
  const home = musterHome(io.env)
  const apps = registered(home)
  if (apps.length === 0) {
    io.out.write('no app is registered: run muster register <file>\n')
    return EXIT.ok
  }
  for (const app of apps) {
    try {
      const registration = readRegistration(app.file, home)
      const file = recipeFile(registration)
      const recipe = runsPinned(registration)
        ? 'pinned'
        : fs.existsSync(file)
          ? file
          : `missing (${file})`
      io.out.write(`${app.id}\t${registration.name}\t${registration.repo}\t${recipe}\n`)
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error
      io.out.write(`${app.id}\tBROKEN: ${error.problems.join('; ')}\n`)
    }
  }
  return EXIT.ok
}

/**
 * Runs one `muster` command and returns its exit code. The app is `--app`, else `MUSTER_APP`, and
 * must be registered; `--repo` picks the checkout whose recipe runs, else the registered one.
 */
export const runCommand = async (argv: string[], io: CommandIo): Promise<number> => {
  const first = argv.at(0)
  const command = first === undefined || first.startsWith('--') ? 'status' : first
  if (command === 'register') return runRegister(argv.at(1), io)
  if (command === 'apps') return runApps(io)
  if (!RIG_COMMANDS.has(command)) {
    io.err.write(`${USAGE}\n`)
    return EXIT.usage
  }
  const flags = parseFlags(argv)
  const id = text(flags, 'app', io.env.MUSTER_APP ?? '')
  if (id === '') {
    io.err.write(`--app <id> is required; muster apps lists them\n${USAGE}\n`)
    return EXIT.usage
  }
  const repo = text(flags, 'repo', '')
  let rig: Rig
  try {
    const checkout = repo === '' ? undefined : path.resolve(io.cwd, repo)
    const config = openApp(musterHome(io.env), id, checkout)
    rig = new Rig(config, {
      repo: config.repo,
      reason: text(flags, 'reason', 'unspecified'),
      wait: flags.wait === true,
      force: flags.force === true,
      out: io.out
    })
  } catch (error) {
    if (!(error instanceof ConfigError) && !(error instanceof NotRegistered)) throw error
    io.err.write(`${error.message}\n`)
    return EXIT.usage
  }
  if (command === 'up') return exitCode(await rig.up())
  if (command === 'release') return exitCode(await rig.release())
  if (command === 'down') return exitCode(await rig.down())
  return exitCode(await rig.status())
}
