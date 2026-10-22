import type { FC } from 'react'

import type { AppView, Job, ReadyApp } from '../../api/musterApi.types'
import Button from '../../components/Button'
import Panel from '../../components/Panel'
import { baseName, modeLabel } from '../../format'
import type { UseActionsReturn } from '../../hooks/useActions.types'
import { hrefOf } from '../../routes'
import { appName, isTaken, ownHold } from '../appStatus'
import { DASHBOARD_REASON } from '../reasons'
import JobPanel from './JobPanel'
import LockCard from './LockCard'
import LogsPanel from './LogsPanel'
import ProcessesTable from './ProcessesTable'
import QueueCard from './QueueCard'
import ReadinessCard from './ReadinessCard'

type AppPageProps = Readonly<{
  app: AppView
  jobs: Job[]
  now: number
  actions: UseActionsReturn
}>

type AppControlsProps = Readonly<{ app: ReadyApp; actions: UseActionsReturn }>

const LAUNCH = { action: 'up', reason: DASHBOARD_REASON } as const

/**
 * What this checkout may do with the rig: launch it when free; restart, release or stop it when it
 * holds it; and when another holds it, launch (which offers the queue) or stop it anyway.
 */
const AppControls: FC<AppControlsProps> = ({ app, actions }) => {
  const disabled = actions.busy !== null
  const run = (steps: Parameters<UseActionsReturn['run']>[1]): void => {
    void actions.run(app.id, steps)
  }

  if (ownHold(app) !== null) {
    return (
      <>
        <Button
          disabled={disabled}
          onClick={() => {
            run([{ action: 'down' }, LAUNCH])
          }}
        >
          Restart all
        </Button>
        <Button
          tone="primary"
          disabled={disabled}
          onClick={() => {
            run([{ action: 'release' }])
          }}
        >
          Release rig
        </Button>
        <Button
          tone="danger"
          disabled={disabled}
          onClick={() => {
            run([{ action: 'down' }])
          }}
        >
          Stop all
        </Button>
      </>
    )
  }

  if (!isTaken(app.snapshot)) {
    return (
      <Button
        tone="primary"
        disabled={disabled}
        onClick={() => {
          run([LAUNCH])
        }}
      >
        Launch
      </Button>
    )
  }

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          run([LAUNCH])
        }}
      >
        Launch
      </Button>
      <Button
        tone="danger"
        disabled={disabled}
        onClick={() => {
          if (window.confirm(`Stop ${app.config.name} for whoever holds it?`)) {
            run([{ action: 'down', force: true }])
          }
        }}
      >
        Stop anyway
      </Button>
    </>
  )
}

/** One app: its controls, lock, queue, readiness, processes, logs and last action. */
const AppPage: FC<AppPageProps> = ({ app, jobs, now, actions }) => {
  const last = jobs.find((job) => job.app === app.id)

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-faint">
        <a href={hrefOf({ page: 'fleet' })}>Fleet</a> <span aria-hidden="true">/</span>{' '}
        {appName(app)}
      </nav>

      <div className="flex flex-wrap items-end gap-6">
        <h1 className="m-0 flex flex-[1_1_420px] flex-col gap-2 font-normal">
          <span className="text-[13px] leading-snug font-bold tracking-[0.09em] text-ink-faint uppercase">
            App ·{' '}
            {app.ok
              ? modeLabel(app.config.instances.mode, app.config.instances.max).toLowerCase()
              : 'config broken'}
          </span>
          <span className="font-display text-[34px] leading-[1.08] tracking-[-0.02em] text-ink">
            {appName(app)}
          </span>
          {app.ok ? (
            <span className="font-display text-2xl leading-[1.28] text-brand-bright italic">
              {app.config.processes.length} processes · {baseName(app.config.repo)}
            </span>
          ) : null}
        </h1>
        <div className="flex flex-wrap gap-2">
          {app.ok ? <AppControls app={app} actions={actions} /> : null}
        </div>
      </div>

      {app.ok ? (
        <>
          <div className="flex flex-wrap gap-6">
            <section
              aria-labelledby="lock-heading"
              className="flex min-w-0 flex-[1_1_360px] flex-col gap-2"
            >
              <h2 id="lock-heading" className="m-0 mx-1 text-[13px] font-medium text-ink-faint">
                Lock
              </h2>
              <LockCard app={app} now={now} />
            </section>
            <section
              aria-labelledby="queue-heading"
              className="flex min-w-0 flex-[1_1_360px] flex-col gap-2"
            >
              <h2 id="queue-heading" className="m-0 mx-1 text-[13px] font-medium text-ink-faint">
                Queue · {app.snapshot.queue.length} waiting
              </h2>
              <QueueCard queue={app.snapshot.queue} now={now} />
              <h2 className="m-0 mx-1 mt-3 text-[13px] font-medium text-ink-faint">Readiness</h2>
              <ReadinessCard app={app} />
            </section>
          </div>

          <Panel
            title={
              <>
                Processes{' '}
                <span className="text-sm font-medium text-ink-faint">in launch order</span>
              </>
            }
            labelledBy="processes-heading"
            actions={
              <a href={hrefOf({ page: 'config', id: app.id })} className="text-sm font-medium">
                Edit config
              </a>
            }
          >
            <ProcessesTable app={app} />
          </Panel>

          <LogsPanel key={app.id} app={app} />
        </>
      ) : (
        <Panel title="The config does not load" labelledBy="problems-heading">
          <ul className="m-0 flex flex-col gap-1 px-5 pb-5 pl-10 text-sm text-status-error">
            {app.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          <p className="m-0 px-5 pb-5 text-sm">
            <a href={hrefOf({ page: 'config', id: app.id })}>Fix the config</a>
          </p>
        </Panel>
      )}

      {last === undefined ? null : <JobPanel key={last.id} job={last} />}
    </>
  )
}

export default AppPage
