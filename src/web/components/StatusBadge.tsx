import type { FC } from 'react'

import type { ProcessStatus } from './StatusBadge.types'

const LABELS: Record<ProcessStatus, string> = {
  ok: 'Running',
  warn: 'Starting',
  error: 'Crashed',
  idle: 'Stopped'
}

const TONES: Record<ProcessStatus, string> = {
  ok: 'bg-status-ok-soft text-status-ok',
  warn: 'bg-status-warn-soft text-status-warn',
  error: 'bg-status-error-soft text-status-error',
  idle: 'bg-status-idle-soft text-status-idle'
}

const DOTS: Record<ProcessStatus, string> = {
  ok: 'bg-status-ok',
  warn: 'bg-status-warn',
  error: 'bg-status-error',
  idle: 'border-[1.5px] border-status-idle'
}

interface StatusBadgeProps {
  status: ProcessStatus
  label?: string
}

/** A state is never colour alone: the badge always carries the word. */
const StatusBadge: FC<StatusBadgeProps> = ({ status, label }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[13px] font-medium ${TONES[status]}`}
  >
    <span aria-hidden="true" className={`size-[7px] rounded-full ${DOTS[status]}`} />
    {label ?? LABELS[status]}
  </span>
)

export default StatusBadge
