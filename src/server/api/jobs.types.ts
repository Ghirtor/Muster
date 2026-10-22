export type Action = 'up' | 'down' | 'release'

export interface ActionRequest {
  action: Action
  repo?: string
  reason?: string
  wait?: boolean
  force?: boolean
}

export type JobState = 'running' | 'done' | 'cancelled'

export type JobOutcome = 'ok' | 'failed' | 'usage' | 'busy' | 'cancelled'

export interface Job {
  id: string
  app: string
  action: Action
  args: string[]
  state: JobState
  pid: number | null
  exitCode: number | null
  outcome: JobOutcome | null
  startedAt: string
  endedAt: string | null
}

export type JobEvent = { type: 'job'; job: Job } | { type: 'job-output'; id: string; text: string }

export type Started = { ok: true; job: Job } | { ok: false; running: Job }
