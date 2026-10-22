import type { AppView, Lock, RigSnapshot } from '../api/musterApi.types'
import type { ProcessStatus } from '../components/StatusBadge.types'
import { heldFrom } from '../format'

const STATES = {
  up: { status: 'ok', label: 'Running' },
  partial: { status: 'warn', label: 'Partly up' },
  down: { status: 'idle', label: 'Stopped' }
} as const

/** An app's badge: its rig state, or `Config broken` when its config does not load. */
export const appStatus = (app: AppView): { status: ProcessStatus; label: string } =>
  app.ok ? STATES[app.snapshot.state] : { status: 'error', label: 'Config broken' }

/** The name the dashboard shows for an app. */
export const appName = (app: AppView): string => (app.ok ? app.config.name : app.id)

/** Whether an app answers a search: its name, checkout, process names or ports. */
export const matches = (app: AppView, search: string): boolean => {
  const needle = search.trim().toLowerCase()
  if (needle === '') return true
  const words = app.ok
    ? [
        app.config.name,
        app.config.repo,
        ...app.config.processes.flatMap((proc) => [proc.key, proc.label, ...proc.ports.map(String)])
      ]
    : [app.id, app.file]
  return words.some((word) => word.toLowerCase().includes(needle))
}

/** Whether the rig is held, by a lock or by processes started outside Muster. */
export const isTaken = (snapshot: RigSnapshot): boolean =>
  snapshot.holders.length > 0 || snapshot.foreign

/** The holder that is this app's own checkout, if one is. */
export const ownHold = (app: AppView): Lock | null =>
  app.ok ? (app.snapshot.holders.find((lock) => heldFrom(lock, app.config.repo)) ?? null) : null
