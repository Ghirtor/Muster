import { useState } from 'react'
import type { FC } from 'react'

import type { AppView, Job } from '../../api/musterApi.types'
import Panel from '../../components/Panel'
import { checkoutOf, since } from '../../format'
import type { UseActionsReturn } from '../../hooks/useActions.types'
import { appName, matches } from '../appStatus'
import { DASHBOARD_REASON } from '../reasons'
import ActivityList from './ActivityList'
import AppsTable from './AppsTable'
import MetricCard from './MetricCard'
import PortsGrid from './PortsGrid'

type Filter = 'all' | 'running' | 'stopped'

type FleetPageProps = Readonly<{
  apps: AppView[]
  jobs: Job[]
  hostname: string | null
  search: string
  now: number
  actions: UseActionsReturn
}>

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'stopped', label: 'Stopped' }
]

/** Whether an app belongs under a filter: running is up or partly up, stopped is down or broken. */
const inFilter = (app: AppView, filter: Filter): boolean => {
  if (filter === 'all') return true
  const running = app.ok && app.snapshot.state !== 'down'
  return filter === 'running' ? running : !running
}

/** The machine at a glance: what runs, who holds it, who waits, and every app with its actions. */
const FleetPage: FC<FleetPageProps> = ({ apps, jobs, hostname, search, now, actions }) => {
  const [filter, setFilter] = useState<Filter>('all')

  const ready = apps.flatMap((app) => (app.ok ? [app] : []))
  const running = ready.filter((app) => app.snapshot.state === 'up')
  const listening = ready.reduce((sum, app) => sum + app.snapshot.listening, 0)
  const total = ready.reduce((sum, app) => sum + app.snapshot.total, 0)
  const processes = ready.reduce((sum, app) => sum + app.config.processes.length, 0)
  const holder = ready.flatMap((app) => app.snapshot.holders).at(0)
  const queue = ready.flatMap((app) => app.snapshot.queue)
  const next = queue.at(0)
  const shown = apps.filter((app) => matches(app, search) && inFilter(app, filter))

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-[1_1_320px]">
          {hostname === null ? null : (
            <div className="text-[13px] font-bold tracking-[0.09em] text-ink-faint uppercase">
              {hostname}
            </div>
          )}
          <h1 className="m-0 mt-1.5 text-[30px] leading-tight font-semibold tracking-[-0.015em]">
            Fleet
          </h1>
          <p className="m-0 mt-1.5 text-[15px] text-ink-muted">
            Every app this machine can launch, who holds it and what it is running.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        <MetricCard
          label="Apps running"
          value={String(running.length)}
          of={String(apps.length)}
          hint={
            running.length === 0 ? 'Nothing running' : running.map((app) => appName(app)).join(', ')
          }
          tone={running.length === 0 ? 'muted' : 'ok'}
        />
        <MetricCard
          label="Processes listening"
          value={String(listening)}
          of={String(total)}
          hint={`${processes} processes · ${total} ports`}
        />
        <MetricCard
          label="Lock holder"
          compact
          value={holder === undefined ? 'Free' : checkoutOf(holder)}
          hint={
            holder === undefined
              ? 'No rig is held'
              : [`held ${since(holder.since, now)}`, holder.reason].filter(Boolean).join(' · ')
          }
        />
        <MetricCard
          label="Waiting in queue"
          value={String(queue.length)}
          hint={
            next === undefined
              ? 'Nobody waiting'
              : `${checkoutOf(next)} waiting ${since(next.since, now)}`
          }
          tone={next === undefined ? 'muted' : 'warn'}
        />
      </div>

      <Panel
        title="Apps"
        labelledBy="apps-heading"
        actions={
          <div
            role="group"
            aria-label="Filter"
            className="inline-flex rounded-pill bg-surface-sunken p-[3px]"
          >
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => {
                  setFilter(option.value)
                }}
                className={`h-8 rounded-pill px-3.5 text-[13px] font-medium ${filter === option.value ? 'bg-surface text-ink shadow-elevation-1' : 'text-ink-muted hover:text-ink'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      >
        {shown.length === 0 ? (
          <p className="m-0 border-t border-line-subtle px-5 py-6 text-sm text-ink-faint">
            {apps.length === 0
              ? 'No app is registered. Register one with muster register <file>.'
              : 'No app matches.'}
          </p>
        ) : (
          <AppsTable
            apps={shown}
            now={now}
            busy={actions.busy}
            onLaunch={(app) => {
              void actions.run(app.id, [{ action: 'up', reason: DASHBOARD_REASON }])
            }}
            onRelease={(app) => {
              void actions.run(app.id, [{ action: 'release' }])
            }}
          />
        )}
      </Panel>

      <div className="flex flex-wrap gap-6">
        <Panel title="Activity" labelledBy="activity-heading" className="min-w-0 flex-[2_1_480px]">
          <ActivityList jobs={jobs} apps={apps} />
        </Panel>
        <Panel title="Ports in use" labelledBy="ports-heading" className="min-w-0 flex-[1_1_320px]">
          <PortsGrid ports={ready.flatMap((app) => app.snapshot.ports)} />
        </Panel>
      </div>
    </>
  )
}

export default FleetPage
