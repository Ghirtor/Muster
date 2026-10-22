import type { ChildProcess } from 'node:child_process'

export interface Launched {
  child: ChildProcess
  log: string
  exited: () => boolean
}

export interface Settled {
  ok: boolean
  exited: boolean
  out: string
}
