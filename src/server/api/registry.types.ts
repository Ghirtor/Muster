import type { RigConfig } from '../engine/config.types'

export type AppEntry =
  | { id: string; file: string; registration: string; config: RigConfig; problems: null }
  | { id: string; file: string; registration: string; config: null; problems: string[] }

export type Validation = { ok: true; config: RigConfig } | { ok: false; problems: string[] }

export type LoadedEntry = Extract<AppEntry, { problems: null }>
