import { useState } from 'react'

import { flotillaApi, useStartActionMutation } from '../api/flotillaApi'
import type { ActionRequest, ApiFailure, Job } from '../api/flotillaApi.types'
import { waitForJob } from '../api/socket'
import useAppDispatch from '../store/useAppDispatch'
import type { Blocked, UseActionsReturn } from './useActions.types'

const ENDINGS: Record<string, string> = {
  failed: 'failed',
  usage: 'was refused',
  cancelled: 'was cancelled'
}

/** The message of whatever a failed request threw. */
const messageOf = (caught: unknown): string => {
  const failure = caught as Partial<ApiFailure> | null
  if (typeof failure?.message === 'string') return failure.message
  return caught instanceof Error ? caught.message : 'failed'
}

/**
 * Runs actions one after another, each as a supervisor job, stopping at the first that does not end
 * ok. A launch refused because another checkout holds the rig is `blocked`, for the launch-blocked
 * dialog, rather than an error.
 */
const useActions = (): UseActionsReturn => {
  const [startAction] = useStartActionMutation()
  const dispatch = useAppDispatch()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<Blocked | null>(null)

  const readJob = async (id: string): Promise<Job> => {
    const request = dispatch(
      flotillaApi.endpoints.getJob.initiate(id, { subscribe: false, forceRefetch: true })
    )
    return (await request.unwrap()).job
  }

  const run = async (app: string, steps: ActionRequest[]): Promise<void> => {
    setBusy(app)
    setError(null)
    setBlocked(null)
    try {
      for (const step of steps) {
        const started = await startAction({ app, ...step }).unwrap()
        const job = await waitForJob(started.id, async () => await readJob(started.id))
        if (job.outcome === 'busy') {
          setBlocked({ app, reason: step.reason ?? '' })
          return
        }
        if (job.outcome !== 'ok') {
          setError(`${step.action} ${ENDINGS[job.outcome ?? 'failed'] ?? 'failed'}`)
          return
        }
      }
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  const dismiss = (): void => {
    setBlocked(null)
    setError(null)
  }

  return { busy, error, blocked, run, dismiss }
}

export default useActions
