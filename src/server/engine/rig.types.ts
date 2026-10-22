import type { LaunchVerdict, Lock, QueueEntry } from './lock.types'
import type { Output } from './output.types'

export interface RigOptions {
  repo: string
  reason: string
  wait: boolean
  force: boolean
  out: Output
  pollMs?: number
  tickMs?: number
}

export interface Outcome {
  ok: boolean
  busy: boolean
}

export interface PortRow {
  port: number
  key: string
  label: string
  up: boolean
}

export type RigState = 'up' | 'partial' | 'down'

export interface Holder extends Lock {
  mine: boolean
}

export interface RigSnapshot {
  state: RigState
  holders: Holder[]
  queue: QueueEntry[]
  foreign: boolean
  launch: LaunchVerdict
  ports: PortRow[]
  listening: number
  total: number
}
