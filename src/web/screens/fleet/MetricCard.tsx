import type { FC } from 'react'

type MetricCardProps = Readonly<{
  label: string
  value: string
  of?: string
  hint: string
  tone?: 'ok' | 'warn' | 'muted'
  compact?: boolean
}>

const TONES = { ok: 'text-status-ok', warn: 'text-status-warn', muted: 'text-ink-faint' }

/** One fleet figure: a label, the number (or a short name when `compact`) and a line under it. */
const MetricCard: FC<MetricCardProps> = ({ label, value, of, hint, tone = 'muted', compact }) => (
  <div className="flex flex-col gap-1.5 rounded-md bg-surface p-5 shadow-elevation-1">
    <span className="text-[13px] text-ink-faint">{label}</span>
    <span
      className={`font-semibold tabular-nums ${compact === true ? 'truncate text-xl leading-normal tracking-[-0.01em]' : 'text-[30px] tracking-[-0.015em]'}`}
    >
      {value}
      {of === undefined ? null : (
        <span className="text-[17px] font-normal text-ink-faint"> of {of}</span>
      )}
    </span>
    <span className={`truncate text-[13px] ${TONES[tone]}`}>{hint}</span>
  </div>
)

export default MetricCard
