import { Jobs } from './jobs'
import type { Job, JobEvent } from './jobs.types'
import type { AppEntry } from './registry.types'

const app: AppEntry = { id: 'fixture', file: 'fixture.yaml', config: null, problems: ['unused'] }

/** Resolves with the job once `jobs` reports it ended. */
const ended = async (jobs: Jobs, id: string): Promise<Job> =>
  await new Promise((resolve) => {
    const stop = jobs.onEvent((event: JobEvent) => {
      if (event.type === 'job' && event.job.id === id && event.job.endedAt !== null) {
        stop()
        resolve(event.job)
      }
    })
  })

describe('Jobs', () => {
  it('keeps a cancelled job running, and the app busy, until its process exits', async () => {
    const jobs = new Jobs([process.execPath, '-e', 'setTimeout(() => {}, 30_000)'])
    const started = jobs.start(app, { action: 'up' })
    if (!started.ok) throw new Error('the first job did not start')
    const done = ended(jobs, started.job.id)

    expect(jobs.cancel(started.job.id)).toBe(true)
    expect(jobs.get(started.job.id)?.job.state).toBe('running')
    expect(jobs.start(app, { action: 'down' })).toMatchObject({ ok: false })

    await expect(done).resolves.toMatchObject({ state: 'cancelled', outcome: 'cancelled' })
    expect(jobs.cancel(started.job.id)).toBe(false)
    const next = jobs.start(app, { action: 'down' })
    expect(next).toMatchObject({ ok: true })
    jobs.stopAll()
  }, 30_000)
})
