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

export interface Repair {
  match: RegExp
  steps: RepairStep[]
  cleanup: boolean
  cwd?: string
  vars: Record<string, string>
}

export interface BuildGroup {
  sequential: boolean
  cmd: string
}

export interface ProcessBuild {
  group: string
  project: string
}

export interface SlowStart {
  startFirst: boolean
  timeoutMs: number
}

export interface ProcessConfig {
  key: string
  label: string
  ports: number[]
  cwd: string
  cmd: string
  env: Record<string, string>
  after: string[]
  build?: ProcessBuild
  slow?: SlowStart
  timeoutMs: number
  onFailure: Repair[]
}

export type ReadyCheck =
  | { kind: 'ports'; ports: number[]; timeoutMs: number }
  | { kind: 'cdp'; port: number; anyOf: string[]; timeoutMs: number }

export interface ToolConfig {
  key: string
  probe: string
  onFailure: Repair[]
}

export interface Recipe {
  buildGroups: Record<string, BuildGroup>
  processes: ProcessConfig[]
  ready: ReadyCheck[]
  tools: ToolConfig[]
  logs: string
}

export interface RecipeSource {
  file: string
  hash: string
  pinned: boolean
}

export interface RecipeText {
  text: string
  file: string
}

export interface Registration {
  id: string
  file: string
  name: string
  repo: string
  recipe: string
  instances: InstancesConfig
  pinned: Record<string, unknown> | null
}

export interface RigConfig {
  id: string
  name: string
  repo: string
  recipe: RecipeSource
  instances: InstancesConfig
  buildGroups: Record<string, BuildGroup>
  processes: ProcessConfig[]
  ready: ReadyCheck[]
  tools: ToolConfig[]
  logs: string
}
