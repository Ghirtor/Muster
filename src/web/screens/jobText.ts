import type { Action, Job } from '../api/flotillaApi.types'

const VERBS: Record<Action, string> = { up: 'Launch', down: 'Stop', release: 'Release' }

const ENDS = {
  ok: 'done',
  failed: 'failed',
  usage: 'refused',
  busy: 'blocked: another checkout holds the rig',
  cancelled: 'cancelled'
} as const

/** What a job did, in words: `Launch done`, `Stop failed`, `Release running`. */
export const jobText = (job: Job): string =>
  `${VERBS[job.action]} ${job.state === 'running' ? 'running' : ENDS[job.outcome ?? 'failed']}`

/** The tone of a job's ending, for its badge. */
export const jobTone = (job: Job): 'ok' | 'warn' | 'error' | 'idle' => {
  if (job.state === 'running') return 'warn'
  if (job.outcome === 'ok') return 'ok'
  return job.outcome === 'cancelled' ? 'idle' : 'error'
}
