import type {
  BuildGroup,
  InstancesConfig,
  ProcessBuild,
  ReadyCheck,
  RepairStep,
  SlowStart
} from '../engine/config.types'
import type { RigSnapshot } from '../engine/rig.types'

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
  build?: ProcessBuild
  slow?: SlowStart
  timeoutMs: number
  onFailure: RepairView[]
}

export interface ConfigView {
  name: string
  repo: string
  instances: InstancesConfig
  buildGroups: Record<string, BuildGroup>
  processes: ProcessView[]
  ready: ReadyCheck[]
  tools: { key: string; probe: string; onFailure: RepairView[] }[]
  logs: string
}

export type AppView =
  | { id: string; file: string; ok: true; config: ConfigView; snapshot: RigSnapshot }
  | { id: string; file: string; ok: false; problems: string[] }
