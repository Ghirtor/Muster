import type { ActionRequest } from '../api/musterApi.types'

export interface Blocked {
  app: string
  reason: string
}

export interface UseActionsReturn {
  busy: string | null
  error: string | null
  blocked: Blocked | null
  run: (app: string, steps: ActionRequest[]) => Promise<void>
  dismiss: VoidFunction
}
