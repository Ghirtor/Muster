import type { InstanceMode, Lock, PortRow, ProcessView } from './api/flotillaApi.types'
import type { ProcessStatus } from './components/StatusBadge.types'

const MODES: Record<InstanceMode, string> = {
  'one-per-machine': 'One per machine',
  'one-per-checkout': 'One per checkout',
  'up-to-n': 'Up to N'
}

/** How many instances an app allows, in words. */
export const modeLabel = (mode: InstanceMode, max = 1): string =>
  mode === 'up-to-n' ? `Up to ${max}` : MODES[mode]

/** A span of time the way the dashboard writes it: `12 s`, `42 m`, `3 h 5 m`, `2 d 4 h`. */
export const duration = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} m`
  return `${Math.floor(hours / 24)} d ${hours % 24} h`
}

/** How long ago `iso` was, as a duration. */
export const since = (iso: string, now: number): string => duration(now - Date.parse(iso))

/** The local time of day of `iso`, `HH:MM`. */
export const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

/** The last folder of a path, either separator. */
export const baseName = (file: string): string =>
  file
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .at(-1) ?? file

/** A branch to show: blank when git did not know it, which the engine records as `?`. */
export const knownBranch = (branch: string): string => (branch === '?' ? '' : branch)

/** A checkout in words: its folder, then its branch when it is known. */
export const checkoutOf = (held: { repo: string; branch: string }): string =>
  [baseName(held.repo), knownBranch(held.branch)].filter(Boolean).join(' · ')

/** Whether a lock was taken from `repo`, paths compared the way Windows compares them. */
export const heldFrom = (lock: Lock, repo: string): boolean => {
  const normal = (file: string): string =>
    file
      .replace(/[\\/]+/g, '/')
      .replace(/\/$/, '')
      .toLowerCase()
  return normal(lock.repo) === normal(repo)
}

/** A process's state from its ports: all listening, some, or none. */
export const processStatus = (proc: ProcessView, ports: PortRow[]): ProcessStatus => {
  const mine = ports.filter((row) => row.key === proc.key)
  const up = mine.filter((row) => row.up).length
  if (mine.length > 0 && up === mine.length) return 'ok'
  return up > 0 ? 'warn' : 'idle'
}
