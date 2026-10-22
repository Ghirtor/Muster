import { useState } from 'react'
import type { FC } from 'react'

import { useFollowLogQuery } from '../../api/musterApi'
import type { ReadyApp } from '../../api/musterApi.types'
import Console from '../../components/Console'

type LogsPanelProps = Readonly<{ app: ReadyApp }>

/** One process's log at a time, streamed as it is written; Follow keeps the newest line in view. */
const LogsPanel: FC<LogsPanelProps> = ({ app }) => {
  const processes = app.config.processes
  const [picked, setPicked] = useState(processes.at(0)?.key ?? '')
  const [follow, setFollow] = useState(true)
  const key = processes.some((proc) => proc.key === picked) ? picked : (processes.at(0)?.key ?? '')
  const { data: text = '' } = useFollowLogQuery({ app: app.id, key }, { skip: key === '' })

  const label = processes.find((proc) => proc.key === key)?.label ?? key

  return (
    <section
      id="logs"
      aria-labelledby="logs-heading"
      className="flex flex-col gap-3 rounded-md bg-surface px-5 pt-4 pb-5 shadow-elevation-1"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="logs-heading" className="m-0 text-[17px] font-semibold">
          Logs
        </h2>
        <div
          role="tablist"
          aria-label="Process"
          className="inline-flex flex-wrap rounded-pill bg-surface-sunken p-[3px]"
        >
          {processes.map((proc) => (
            <button
              key={proc.key}
              type="button"
              role="tab"
              aria-selected={proc.key === key}
              onClick={() => {
                setPicked(proc.key)
              }}
              className={`h-8 rounded-pill px-3 text-[13px] font-medium ${proc.key === key ? 'bg-surface text-ink shadow-elevation-1' : 'text-ink-muted hover:text-ink'}`}
            >
              {proc.label}
            </button>
          ))}
        </div>
        <label className="ml-auto inline-flex h-9 items-center gap-2 rounded-pill border border-line px-3.5 text-[13px] text-ink-muted">
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => {
              setFollow(event.target.checked)
            }}
            className="m-0 size-4 accent-brand"
          />
          Follow
        </label>
      </div>
      <Console
        text={text}
        label={`${label} log`}
        follow={follow}
        empty="Nothing logged yet."
        className="max-h-[420px] min-h-40"
      />
    </section>
  )
}

export default LogsPanel
