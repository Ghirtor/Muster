import path from 'node:path'

import type { CommandIo, Flags } from './command.types'
import { ConfigError, loadConfig } from './engine/config'
import { Rig } from './engine/rig'
import type { Outcome } from './engine/rig.types'

export const USAGE =
  'usage: flotilla [status|up|release|down] [--config <file>] [--repo <path>] [--reason <text>] [--wait] [--force]'

export const EXIT = { ok: 0, failed: 1, usage: 2, busy: 3 } as const

const COMMANDS = new Set(['status', 'up', 'release', 'down'])

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

/**
 * Runs one `flotilla` command and returns its exit code. The config comes from `--config`, then
 * `FLOTILLA_CONFIG`, then `flotilla.yaml` in the working directory; `--repo` overrides its `repo`.
 */
export const runCommand = async (argv: string[], io: CommandIo): Promise<number> => {
  const first = argv.at(0)
  const command = first === undefined || first.startsWith('--') ? 'status' : first
  if (!COMMANDS.has(command)) {
    io.err.write(`${USAGE}\n`)
    return EXIT.usage
  }
  const flags = parseFlags(argv)
  const file = text(flags, 'config', io.env.FLOTILLA_CONFIG ?? path.join(io.cwd, 'flotilla.yaml'))
  let rig: Rig
  try {
    const config = loadConfig(path.resolve(io.cwd, file))
    rig = new Rig(config, {
      repo: path.resolve(io.cwd, text(flags, 'repo', config.repo)),
      reason: text(flags, 'reason', 'unspecified'),
      wait: flags.wait === true,
      force: flags.force === true,
      out: io.out
    })
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error
    io.err.write(`${error.message}\n`)
    return EXIT.usage
  }
  if (command === 'up') return exitCode(await rig.up())
  if (command === 'release') return exitCode(await rig.release())
  if (command === 'down') return exitCode(await rig.down())
  return exitCode(await rig.status())
}
