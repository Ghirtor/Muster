import type { FC } from 'react'

import type { ReadyApp } from '../../api/flotillaApi.types'
import StatusBadge from '../../components/StatusBadge'
import { processStatus } from '../../format'

type ProcessesTableProps = Readonly<{ app: ReadyApp }>

const LABELS = {
  ok: 'Listening',
  warn: 'Partly listening',
  error: 'Crashed',
  idle: 'Not listening'
}
const HEAD = 'px-3 py-2.5 font-medium'
const CELL = 'px-3 py-3 align-top'

/** The app's processes in launch order, each with its ports and whether they listen. */
const ProcessesTable: FC<ProcessesTableProps> = ({ app }) => {
  const labelOf = (key: string): string =>
    app.config.processes.find((proc) => proc.key === key)?.label ?? key

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-sm leading-[1.45]">
        <thead>
          <tr className="bg-surface-sunken text-left text-[13px] text-ink-faint">
            <th className={`${HEAD} w-7 pl-5`}>#</th>
            <th className={HEAD}>Process</th>
            <th className={HEAD}>Ports</th>
            <th className={HEAD}>Status</th>
            <th className={HEAD}>After</th>
            <th className={`${HEAD} pr-5`}>Build</th>
          </tr>
        </thead>
        <tbody>
          {app.config.processes.map((proc, index) => {
            const status = processStatus(proc, app.snapshot.ports)
            return (
              <tr key={proc.key} className="border-t border-line-subtle hover:bg-brand-soft">
                <td className={`${CELL} pl-5 text-ink-faint`}>{index + 1}</td>
                <td className={CELL}>
                  <div className="font-semibold">{proc.label}</div>
                  <div className="mt-0.5 font-mono text-xs break-all text-ink-muted">
                    {proc.cmd}
                  </div>
                </td>
                <td className={`${CELL} font-mono text-[13px]`}>
                  {proc.ports.length === 0 ? '—' : proc.ports.join(', ')}
                </td>
                <td className={CELL}>
                  {proc.ports.length === 0 ? (
                    <span className="text-ink-faint">No port</span>
                  ) : (
                    <StatusBadge status={status} label={LABELS[status]} />
                  )}
                </td>
                <td className={`${CELL} text-ink-muted`}>
                  {proc.after.length === 0 ? '—' : proc.after.map(labelOf).join(', ')}
                </td>
                <td className={`${CELL} pr-5 font-mono text-[13px] text-ink-muted`}>
                  {proc.build === undefined ? '—' : `${proc.build.group}: ${proc.build.project}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ProcessesTable
