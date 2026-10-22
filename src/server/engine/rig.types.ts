import type { Lock, QueueEntry } from './lock.types'
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

export interface RigSnapshot {
  state: RigState
  holders: Lock[]
  queue: QueueEntry[]
  foreign: boolean
  ports: PortRow[]
  listening: number
  total: number
}
