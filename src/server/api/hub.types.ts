import type { RigSnapshot } from '../engine/rig.types'
import type { JobEvent } from './jobs.types'

export interface HubOptions {
  statusMs?: number
  logMs?: number
}

export type ServerMessage =
  | { type: 'status'; app: string; snapshot: RigSnapshot | null; problems: string[] | null }
  | { type: 'log'; app: string; key: string; text: string; reset: boolean }
  | { type: 'error'; message: string }
  | JobEvent

export interface ClientMessage {
  type: 'subscribe' | 'unsubscribe'
  topics: string[]
}
