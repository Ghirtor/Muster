import type { InstancesConfig } from './config.types'
import type { Output } from './output.types'

export interface LockRecipe {
  file: string
  hash: string
}

export interface Lock {
  repo: string
  branch: string
  reason: string
  since: string
  touched?: string
  pids?: number[]
  recipe?: LockRecipe
  ports?: number[]
}

export interface QueueEntry {
  repo: string
  branch: string
  reason: string
  since: string
  pid: number
}

export interface HeldSlot {
  file: string
  lock: Lock
}

export interface LockContext {
  instances: InstancesConfig
  repo: string
  ports: number[]
  recipe?: LockRecipe
  out: Output
  pollMs: number
}

export interface AcquireOptions {
  reason: string
  wait: boolean
  onStale: () => Promise<unknown>
}

export type AcquireResult = { held: true; file: string } | { held: false; foreign: boolean }

export type LaunchVerdict =
  | { kind: 'held'; lock: Lock }
  | { kind: 'free'; takesOver: Lock | null }
  | { kind: 'queue'; behind: Lock | null; ahead: number }
  | { kind: 'foreign' }
