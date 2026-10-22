export type InstanceMode = 'one-per-machine' | 'one-per-checkout' | 'up-to-n'

export interface InstancesConfig {
  mode: InstanceMode
  max: number
  lock: string
  staleAfterMs: number
  whenBusy: 'fail' | 'wait'
  killImages: string[]
}

export interface RepairStep {
  run: string
  unlessExists?: string
}

export interface RepairView {
  match: string
  steps: RepairStep[]
  cleanup: boolean
  cwd?: string
  vars: Record<string, string>
}

export interface ProcessView {
  key: string
  label: string
  ports: number[]
  cwd: string
  cmd: string
  env: Record<string, string>
  after: string[]
  build?: { group: string; project: string }
  slow?: { startFirst: boolean; timeoutMs: number }
  timeoutMs: number
  onFailure: RepairView[]
}

export type ReadyCheck =
  | { kind: 'ports'; ports: number[]; timeoutMs: number }
  | { kind: 'cdp'; port: number; anyOf: string[]; timeoutMs: number }

export interface ConfigView {
  name: string
  repo: string
  instances: InstancesConfig
  buildGroups: Record<string, { sequential: boolean; cmd: string }>
  processes: ProcessView[]
  ready: ReadyCheck[]
  tools: { key: string; probe: string; onFailure: RepairView[] }[]
  logs: string
}

export interface Lock {
  repo: string
  branch: string
  reason: string
  since: string
  touched?: string
  pids?: number[]
}

export interface QueueEntry {
  repo: string
  branch: string
  reason: string
  since: string
  pid: number
}

export interface PortRow {
  port: number
  key: string
  label: string
  up: boolean
}

export type RigState = 'up' | 'partial' | 'down'

export interface RigSnapshot {
  state: RigState
  holders: Lock[]
  queue: QueueEntry[]
  foreign: boolean
  ports: PortRow[]
  listening: number
  total: number
}

export interface ReadyApp {
  id: string
  file: string
  ok: true
  config: ConfigView
  snapshot: RigSnapshot
}

export interface BrokenApp {
  id: string
  file: string
  ok: false
  problems: string[]
}

export type AppView = ReadyApp | BrokenApp

export type Action = 'up' | 'down' | 'release'

export interface ActionRequest {
  action: Action
  reason?: string
  wait?: boolean
  force?: boolean
}

export type JobOutcome = 'ok' | 'failed' | 'usage' | 'busy' | 'cancelled'

export interface Job {
  id: string
  app: string
  action: Action
  args: string[]
  state: 'running' | 'done' | 'cancelled'
  pid: number | null
  exitCode: number | null
  outcome: JobOutcome | null
  startedAt: string
  endedAt: string | null
}

export interface Health {
  ok: boolean
  hostname: string
}

export interface ConfigText {
  file: string
  text: string
  problems: string[] | null
}

export interface Validation {
  ok: boolean
  problems: string[]
}

export type ServerMessage =
  | { type: 'status'; app: string; snapshot: RigSnapshot | null; problems: string[] | null }
  | { type: 'log'; app: string; key: string; text: string; reset: boolean }
  | { type: 'job'; job: Job }
  | { type: 'job-output'; id: string; text: string }
  | { type: 'error'; message: string }

export type Listener = (message: ServerMessage) => void

export interface ApiFailure {
  status: number
  message: string
  problems: string[]
}

export interface HttpRequest {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
}

export interface JobDetail {
  job: Job
  output: string
}

export type AppAction = ActionRequest & { app: string }
