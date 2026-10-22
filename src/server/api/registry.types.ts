import type { RigConfig } from '../engine/config.types'

export type AppEntry =
  | { id: string; file: string; config: RigConfig; problems: null }
  | { id: string; file: string; config: null; problems: string[] }

export type Validation = { ok: true; config: RigConfig } | { ok: false; problems: string[] }
