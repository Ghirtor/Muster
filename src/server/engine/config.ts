import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parse } from 'yaml'

import type {
  BuildGroup,
  InstanceMode,
  InstancesConfig,
  ProcessConfig,
  ReadyCheck,
  Repair,
  RepairStep,
  RigConfig,
  SlowStart,
  ToolConfig
} from './config.types'
import { launchOrder } from './order'

type Raw = Record<string, unknown>

const SECOND = 1000
const MINUTE = 60 * SECOND
const DEFAULT_TIMEOUT_MS = 120 * SECOND
const DEFAULT_SLOW_TIMEOUT_MS = 15 * MINUTE
const DEFAULT_READY_TIMEOUT_MS = 2 * MINUTE
const DEFAULT_STALE_MS = 20 * MINUTE
const MODES: InstanceMode[] = ['one-per-machine', 'one-per-checkout', 'up-to-n']
const UNITS: Record<string, number> = { ms: 1, s: SECOND, m: MINUTE, h: 60 * MINUTE }
const PLACEHOLDER = /\{(\w+)\}/g
const REPAIR_KEYS = new Set(['match', 'run', 'cleanup', 'cwd'])

/** Every problem found in one config file, each prefixed with where in the file it sits. */
export class ConfigError extends Error {
  constructor(
    readonly file: string,
    readonly problems: string[]
  ) {
    super(`${file} is not a valid Flotilla config:\n  ${problems.join('\n  ')}`)
  }
}

/** Whether `value` is a YAML mapping rather than a scalar, a list or null. */
const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A duration: a number of seconds, or a number with `ms`, `s`, `m` or `h`. Null when it is neither. */
export const parseDuration = (value: unknown): number | null => {
  if (typeof value === 'number') return value >= 0 ? value * SECOND : null
  if (typeof value !== 'string') return null
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/.exec(value.trim())
  if (match === null) return null
  return Number(match[1]) * (UNITS[match.at(2) ?? 's'] ?? SECOND)
}

/** `${NAME}` and `${NAME:-default}` replaced from `env`; an unset name without a default is empty. */
export const expandVars = (text: string, env: NodeJS.ProcessEnv = process.env): string =>
  text.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_, name: string, fallback?: string) => {
    const value = env[name]
    return value === undefined || value === '' ? (fallback ?? '') : value
  })

/**
 * A path as written in a config: `~` is the home directory, `%NAME%` and `${NAME}` are environment
 * variables. `%TEMP%` and `%TMP%` fall back to the system temp directory, so a Windows-style log
 * path still resolves on macOS and Linux.
 */
export const expandPath = (text: string, env: NodeJS.ProcessEnv = process.env): string => {
  const windowsVars = expandVars(text, env).replace(/%(\w+)%/g, (whole, name: string) => {
    const value = env[name]
    if (value !== undefined) return value
    return name === 'TEMP' || name === 'TMP' ? os.tmpdir() : whole
  })
  return windowsVars.replace(/^~(?=$|[/\\])/, os.homedir())
}

/**
 * Reads one config tree, collecting every problem rather than stopping at the first, so a broken
 * config is fixed in one pass.
 */
class Reader {
  readonly problems: string[] = []

  constructor(private readonly namedRepairs: Raw) {}

  /** Records a problem at `at`. */
  fail(at: string, message: string): void {
    this.problems.push(`${at}: ${message}`)
  }

  /** Reports the keys of `raw` that are not in `known`, which are most often typos. */
  known(raw: Raw, known: string[], at: string): void {
    for (const key of Object.keys(raw)) {
      if (!known.includes(key)) this.fail(at, `unknown key "${key}"`)
    }
  }

  /** A required non-empty string. */
  text(raw: Raw, key: string, at: string): string {
    const value = raw[key]
    if (typeof value === 'string' && value.trim() !== '') return value
    this.fail(at, `"${key}" must be a non-empty string`)
    return ''
  }

  /** An optional string, or `fallback`. */
  optionalText(raw: Raw, key: string, at: string, fallback: string): string {
    const value = raw[key]
    if (value === undefined) return fallback
    if (typeof value === 'string') return value
    this.fail(at, `"${key}" must be a string`)
    return fallback
  }

  /** A list of strings, or an empty list when absent. */
  texts(raw: Raw, key: string, at: string): string[] {
    const value = raw[key]
    if (value === undefined) return []
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
    this.fail(at, `"${key}" must be a list of strings`)
    return []
  }

  /** An optional duration in milliseconds, or `fallback`. */
  duration(raw: Raw, key: string, at: string, fallback: number): number {
    const value = raw[key]
    if (value === undefined) return fallback
    const parsed = parseDuration(value)
    if (parsed !== null) return parsed
    this.fail(at, `"${key}" must be a duration such as 90s, 15m or 120`)
    return fallback
  }

  /** A port number, accepted only within the TCP range. */
  port(value: unknown, at: string): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 65536) {
      return value
    }
    this.fail(at, `${JSON.stringify(value)} is not a port`)
    return null
  }

  /** A case-insensitive failure signature, as every signature in rig.mjs is. */
  pattern(raw: Raw, at: string): RegExp {
    const source = this.text(raw, 'match', at)
    try {
      return new RegExp(source, 'i')
    } catch {
      this.fail(at, `"match" is not a valid regular expression: ${source}`)
      return /$^/
    }
  }

  /** One step of a repair's `run` list: a command, or a command skipped when a path exists. */
  step(value: unknown, at: string): RepairStep | null {
    if (typeof value === 'string') return { run: value }
    if (isRecord(value)) {
      this.known(value, ['run', 'unlessExists'], at)
      const unlessExists = this.optionalText(value, 'unlessExists', at, '')
      const run = this.text(value, 'run', at)
      return unlessExists === '' ? { run } : { run, unlessExists }
    }
    this.fail(at, 'a step is a command, or { run, unlessExists }')
    return null
  }

  /** A repair, given inline or by its name under `repairs:`. */
  repair(value: unknown, at: string): Repair | null {
    if (typeof value === 'string') {
      const named = this.namedRepairs[value]
      if (named === undefined) {
        this.fail(at, `no repair named "${value}" under repairs:`)
        return null
      }
      return this.repair(named, `repairs.${value}`)
    }
    if (!isRecord(value)) {
      this.fail(at, 'a repair is a mapping with "match" and "run" or "cleanup"')
      return null
    }
    const match = this.pattern(value, at)
    const cleanup = value.cleanup === true
    const run = value.run
    const listed = Array.isArray(run) ? run : run === undefined ? [] : [run]
    const steps = listed.flatMap((step, i) => this.step(step, `${at}.run[${i}]`) ?? [])
    if (!cleanup && steps.length === 0)
      this.fail(at, 'a repair needs "run" steps or "cleanup: true"')
    const vars: Record<string, string> = {}
    for (const [key, field] of Object.entries(value)) {
      if (REPAIR_KEYS.has(key)) continue
      if (typeof field === 'string') vars[key] = field
      else this.fail(at, `"${key}" must be a string to fill {${key}}`)
    }
    for (const step of steps) {
      for (const [, name] of step.run.matchAll(PLACEHOLDER)) {
        if (!(name in vars)) this.fail(at, `{${name}} has no value`)
      }
    }
    const cwd = typeof value.cwd === 'string' ? value.cwd : undefined
    return { match, steps, cleanup, vars, ...(cwd === undefined ? {} : { cwd }) }
  }

  /** A list of repairs, tried in order on a failure. */
  repairs(raw: Raw, key: string, at: string): Repair[] {
    const value = raw[key]
    if (value === undefined) return []
    if (!Array.isArray(value)) {
      this.fail(at, `"${key}" must be a list of repairs`)
      return []
    }
    return value.flatMap((item, i) => this.repair(item, `${at}.${key}[${i}]`) ?? [])
  }
}

/** How many instances may run, and where they take turns. */
const readInstances = (reader: Reader, raw: unknown, name: string): InstancesConfig => {
  const at = 'instances'
  const fallbackLock = path.join(os.homedir(), '.flotilla', slug(name), 'lock.json')
  const instances = isRecord(raw) ? raw : {}
  if (raw !== undefined && !isRecord(raw)) reader.fail(at, 'must be a mapping')
  reader.known(instances, ['mode', 'max', 'lock', 'staleAfter', 'whenBusy', 'killImages'], at)
  const mode = instances.mode ?? 'one-per-machine'
  if (!MODES.includes(mode as InstanceMode)) {
    reader.fail(at, `"mode" must be one of ${MODES.join(', ')}`)
  }
  let max = 1
  if (mode === 'up-to-n') {
    const value = instances.max
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) max = value
    else reader.fail(at, '"max" must be a whole number above 0 for up-to-n')
  } else if (instances.max !== undefined) {
    reader.fail(at, '"max" only applies to mode up-to-n')
  }
  const whenBusy = instances.whenBusy ?? 'fail'
  if (whenBusy !== 'fail' && whenBusy !== 'wait') reader.fail(at, '"whenBusy" must be fail or wait')
  return {
    mode: MODES.includes(mode as InstanceMode) ? (mode as InstanceMode) : 'one-per-machine',
    max,
    lock: path.resolve(expandPath(reader.optionalText(instances, 'lock', at, fallbackLock))),
    staleAfterMs: reader.duration(instances, 'staleAfter', at, DEFAULT_STALE_MS),
    whenBusy: whenBusy === 'wait' ? 'wait' : 'fail',
    killImages: reader.texts(instances, 'killImages', at)
  }
}

/** The build groups, keyed by name. */
const readBuildGroups = (reader: Reader, raw: unknown): Record<string, BuildGroup> => {
  if (raw === undefined) return {}
  if (!isRecord(raw)) {
    reader.fail('buildGroups', 'must be a mapping of group name to { sequential, cmd }')
    return {}
  }
  const groups: Record<string, BuildGroup> = {}
  for (const [name, group] of Object.entries(raw)) {
    const at = `buildGroups.${name}`
    if (!isRecord(group)) {
      reader.fail(at, 'must be a mapping')
      continue
    }
    reader.known(group, ['sequential', 'cmd'], at)
    groups[name] = { sequential: group.sequential === true, cmd: reader.text(group, 'cmd', at) }
  }
  return groups
}

/** `slow: true`, or `slow: { startFirst, timeout }`. */
const readSlow = (reader: Reader, raw: unknown, at: string): SlowStart | undefined => {
  if (raw === undefined || raw === false) return undefined
  if (raw === true) return { startFirst: true, timeoutMs: DEFAULT_SLOW_TIMEOUT_MS }
  if (!isRecord(raw)) {
    reader.fail(at, '"slow" must be true or { startFirst, timeout }')
    return undefined
  }
  reader.known(raw, ['startFirst', 'timeout'], `${at}.slow`)
  return {
    startFirst: raw.startFirst === true,
    timeoutMs: reader.duration(raw, 'timeout', `${at}.slow`, DEFAULT_SLOW_TIMEOUT_MS)
  }
}

/** One process, with its paths relative to the checkout and its env expanded. */
const readProcess = (
  reader: Reader,
  raw: unknown,
  at: string,
  groups: Record<string, BuildGroup>
): ProcessConfig | null => {
  if (!isRecord(raw)) {
    reader.fail(at, 'a process is a mapping')
    return null
  }
  reader.known(
    raw,
    [
      'key',
      'label',
      'ports',
      'cwd',
      'cmd',
      'env',
      'after',
      'build',
      'slow',
      'timeout',
      'onFailure'
    ],
    at
  )
  const key = reader.text(raw, 'key', at)
  const named = key === '' ? at : `${at} (${key})`
  const ports = Array.isArray(raw.ports)
    ? raw.ports.flatMap((port, i) => reader.port(port, `${named}.ports[${i}]`) ?? [])
    : []
  if (!Array.isArray(raw.ports) || ports.length === 0) {
    reader.fail(named, '"ports" must list the ports that prove it is up')
  }
  const env: Record<string, string> = {}
  if (isRecord(raw.env)) {
    for (const [name, value] of Object.entries(raw.env)) {
      if (typeof value === 'string') env[name] = expandVars(value)
      else reader.fail(`${named}.env`, `"${name}" must be a string; quote numbers`)
    }
  } else if (raw.env !== undefined) {
    reader.fail(named, '"env" must be a mapping')
  }
  let build: ProcessConfig['build']
  if (isRecord(raw.build)) {
    const group = reader.text(raw.build, 'group', `${named}.build`)
    const project = reader.text(raw.build, 'project', `${named}.build`)
    if (group !== '' && !(group in groups)) {
      reader.fail(`${named}.build`, `no build group named "${group}"`)
    }
    build = { group, project }
  } else if (raw.build !== undefined) {
    reader.fail(named, '"build" must be { group, project }')
  }
  const slow = readSlow(reader, raw.slow, named)
  const process: ProcessConfig = {
    key,
    label: reader.optionalText(raw, 'label', named, key),
    ports,
    cwd: reader.optionalText(raw, 'cwd', named, '.'),
    cmd: expandVars(reader.text(raw, 'cmd', named)),
    env,
    after: reader.texts(raw, 'after', named),
    timeoutMs: reader.duration(raw, 'timeout', named, slow?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    onFailure: reader.repairs(raw, 'onFailure', named)
  }
  if (build !== undefined) process.build = build
  if (slow !== undefined) process.slow = slow
  if (slow?.startFirst === true && process.after.length > 0) {
    reader.fail(named, 'a process started first cannot wait on "after"')
  }
  return process
}

/** Checks what only the whole list can show: unique keys and ports, known and acyclic `after`. */
const checkProcesses = (reader: Reader, processes: ProcessConfig[]): void => {
  const keys = new Set<string>()
  const owners = new Map<number, string>()
  for (const process of processes) {
    if (keys.has(process.key)) reader.fail('processes', `"${process.key}" is listed twice`)
    keys.add(process.key)
    for (const port of process.ports) {
      const owner = owners.get(port)
      if (owner !== undefined) {
        reader.fail('processes', `port ${port} belongs to both "${owner}" and "${process.key}"`)
      }
      owners.set(port, process.key)
    }
  }
  for (const process of processes) {
    for (const dependency of process.after) {
      if (dependency === process.key) reader.fail(process.key, 'cannot come "after" itself')
      else if (!keys.has(dependency)) {
        reader.fail(process.key, `"after" names "${dependency}", which is not a process`)
      }
    }
  }
  const { cycle } = launchOrder(processes)
  if (cycle.length > 0) reader.fail('processes', `"after" goes in a circle: ${cycle.join(' → ')}`)
}

/** The checks `up` waits on once every process listens. */
const readReady = (reader: Reader, raw: unknown, processes: ProcessConfig[]): ReadyCheck[] => {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    reader.fail('ready', 'must be a list of checks')
    return []
  }
  return raw.flatMap((check, i): ReadyCheck[] => {
    const at = `ready[${i}]`
    if (!isRecord(check)) {
      reader.fail(at, 'a check is { ports } or { cdp }')
      return []
    }
    reader.known(check, ['ports', 'cdp', 'timeout'], at)
    const timeoutMs = reader.duration(check, 'timeout', at, DEFAULT_READY_TIMEOUT_MS)
    if (check.ports !== undefined) {
      if (check.ports === 'all') {
        return [{ kind: 'ports', ports: processes.flatMap((p) => p.ports), timeoutMs }]
      }
      if (Array.isArray(check.ports)) {
        const ports = check.ports.flatMap((port, j) => reader.port(port, `${at}.ports[${j}]`) ?? [])
        return [{ kind: 'ports', ports, timeoutMs }]
      }
      reader.fail(at, '"ports" must be all or a list of ports')
      return []
    }
    if (isRecord(check.cdp)) {
      reader.known(check.cdp, ['port', 'anyOf'], `${at}.cdp`)
      const port = reader.port(check.cdp.port, `${at}.cdp.port`)
      const anyOf = reader.texts(check.cdp, 'anyOf', `${at}.cdp`)
      if (anyOf.length === 0) reader.fail(`${at}.cdp`, '"anyOf" must list the text to wait for')
      return port === null ? [] : [{ kind: 'cdp', port, anyOf, timeoutMs }]
    }
    reader.fail(at, 'a check is { ports } or { cdp: { port, anyOf } }')
    return []
  })
}

/** The tools probed after launch, which have no port. */
const readTools = (reader: Reader, raw: unknown): ToolConfig[] => {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    reader.fail('tools', 'must be a list')
    return []
  }
  return raw.flatMap((tool, i): ToolConfig[] => {
    const at = `tools[${i}]`
    if (!isRecord(tool)) {
      reader.fail(at, 'a tool is { key, probe, onFailure }')
      return []
    }
    reader.known(tool, ['key', 'probe', 'onFailure'], at)
    return [
      {
        key: reader.text(tool, 'key', at),
        probe: reader.text(tool, 'probe', at),
        onFailure: reader.repairs(tool, 'onFailure', at)
      }
    ]
  })
}

/** A name fit for a directory: lower case, with runs of anything else turned into one dash. */
export const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'app'

/**
 * Parses and validates a config's text. `file` resolves a relative `repo` and names the file in
 * errors. Throws a ConfigError listing every problem.
 */
export const parseConfig = (text: string, file: string): RigConfig => {
  let raw: unknown
  try {
    raw = parse(text, { merge: true })
  } catch (error) {
    throw new ConfigError(file, [error instanceof Error ? error.message : String(error)])
  }
  if (!isRecord(raw)) throw new ConfigError(file, ['the file must be a mapping'])
  const reader = new Reader(isRecord(raw.repairs) ? raw.repairs : {})
  reader.known(
    raw,
    ['name', 'repo', 'instances', 'buildGroups', 'repairs', 'processes', 'ready', 'tools', 'logs'],
    'config'
  )
  if (raw.repairs !== undefined && !isRecord(raw.repairs)) {
    reader.fail('repairs', 'must be a mapping of name to repair')
  }
  const name = reader.text(raw, 'name', 'config')
  const repoText = reader.optionalText(raw, 'repo', 'config', '.')
  const groups = readBuildGroups(reader, raw.buildGroups)
  const processes = Array.isArray(raw.processes)
    ? raw.processes.flatMap((p, i) => readProcess(reader, p, `processes[${i}]`, groups) ?? [])
    : []
  if (processes.length === 0) reader.fail('config', '"processes" must list at least one process')
  checkProcesses(reader, processes)
  const fallbackLogs = path.join(os.tmpdir(), 'flotilla-logs', slug(name), '{key}.log')
  const logs = reader.optionalText(raw, 'logs', 'config', fallbackLogs)
  if (!logs.includes('{key}')) reader.fail('logs', 'must contain {key}, one log per process')
  const config: RigConfig = {
    name,
    repo: path.resolve(path.dirname(file), expandPath(repoText)),
    instances: readInstances(reader, raw.instances, name),
    buildGroups: groups,
    processes,
    ready: readReady(reader, raw.ready, processes),
    tools: readTools(reader, raw.tools),
    logs: path.resolve(expandPath(logs))
  }
  if (reader.problems.length > 0) throw new ConfigError(file, reader.problems)
  return config
}

/** Reads and validates the config at `file`. */
export const loadConfig = (file: string): RigConfig => {
  const resolved = path.resolve(file)
  let text: string
  try {
    text = fs.readFileSync(resolved, 'utf8')
  } catch (error) {
    throw new ConfigError(resolved, [error instanceof Error ? error.message : String(error)])
  }
  return parseConfig(text, resolved)
}
