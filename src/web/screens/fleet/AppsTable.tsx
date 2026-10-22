import type { FC } from 'react'

import type { AppView } from '../../api/musterApi.types'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import { baseName, knownBranch, modeLabel, since } from '../../format'
import { hrefOf } from '../../routes'
import { appName, appStatus, isTaken, ownHold } from '../appStatus'
import PortBar from './PortBar'

type AppsTableProps = Readonly<{
  apps: AppView[]
  now: number
  busy: string | null
  onLaunch: (app: AppView) => void
  onRelease: (app: AppView) => void
}>

const CELL = 'px-3 py-3.5 align-top'
const HEAD = 'px-3 py-2.5 font-medium'

/** The fleet's apps, one row each, with Launch or Release where this checkout may do either. */
const AppsTable: FC<AppsTableProps> = ({ apps, now, busy, onLaunch, onRelease }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[980px] border-collapse text-sm leading-[1.45]">
      <thead>
        <tr className="bg-surface-sunken text-left text-[13px] text-ink-faint">
          <th className={`${HEAD} pl-5`}>App</th>
          <th className={HEAD}>Status</th>
          <th className={HEAD}>Instance rule</th>
          <th className={HEAD}>Held by</th>
          <th className={HEAD}>Processes</th>
          <th className={HEAD}>Up for</th>
          <th className={`${HEAD} pr-5 text-right`}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {apps.map((app) => {
          const badge = appStatus(app)
          const holder = app.ok ? app.snapshot.holders.at(0) : undefined
          const mine = ownHold(app)
          const working = busy === app.id
          return (
            <tr key={app.id} className="border-t border-line-subtle hover:bg-brand-soft">
              <td className={`${CELL} pl-5`}>
                <a
                  href={hrefOf({ page: app.ok ? 'app' : 'config', id: app.id })}
                  className="font-semibold text-ink no-underline hover:text-brand"
                >
                  {appName(app)}
                </a>
                <div className="mt-0.5 font-mono text-xs text-ink-faint">
                  {app.ok ? baseName(app.config.repo) : baseName(app.file)}
                </div>
              </td>
              <td className={CELL}>
                <StatusBadge status={badge.status} label={badge.label} />
              </td>
              <td className={CELL}>
                {app.ok ? modeLabel(app.config.instances.mode, app.config.instances.max) : '—'}
              </td>
              <td className={CELL}>
                {holder === undefined ? (
                  <span className="text-ink-faint">
                    {app.ok && app.snapshot.foreign ? 'Outside Muster' : 'Nobody'}
                  </span>
                ) : (
                  <>
                    <div className="font-medium">{baseName(holder.repo)}</div>
                    <div className="font-mono text-xs text-ink-faint">
                      {knownBranch(holder.branch)}
                    </div>
                  </>
                )}
              </td>
              <td className={CELL}>{app.ok ? <PortBar ports={app.snapshot.ports} /> : '—'}</td>
              <td className={`${CELL} tabular-nums`}>
                {holder === undefined ? '—' : since(holder.since, now)}
              </td>
              <td className={`${CELL} pr-5 text-right whitespace-nowrap`}>
                <span className="inline-flex gap-2">
                  <a
                    href={hrefOf({ page: app.ok ? 'app' : 'config', id: app.id })}
                    className="inline-flex h-8 items-center rounded-pill bg-brand-soft px-3.5 text-[13px] font-medium text-brand no-underline hover:bg-selected"
                  >
                    Open
                  </a>
                  {app.ok && mine !== null ? (
                    <Button
                      small
                      disabled={working}
                      onClick={() => {
                        onRelease(app)
                      }}
                    >
                      Release
                    </Button>
                  ) : null}
                  {app.ok && !isTaken(app.snapshot) ? (
                    <Button
                      small
                      disabled={working}
                      onClick={() => {
                        onLaunch(app)
                      }}
                    >
                      Launch
                    </Button>
                  ) : null}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)

export default AppsTable
