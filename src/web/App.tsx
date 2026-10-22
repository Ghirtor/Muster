import { useState } from 'react'
import type { FC } from 'react'

import { useGetHealthQuery, useListAppsQuery, useListJobsQuery } from './api/musterApi'
import useActions from './hooks/useActions'
import useNow from './hooks/useNow'
import useRoute from './hooks/useRoute'
import Header from './layout/Header'
import Sidebar from './layout/Sidebar'
import { hrefOf } from './routes'
import AppPage from './screens/app/AppPage'
import BusyDialog from './screens/busy/BusyDialog'
import ConfigPage from './screens/config/ConfigPage'
import FleetPage from './screens/fleet/FleetPage'
import { DASHBOARD_REASON } from './screens/reasons'

/** The dashboard: header, app navigator, the routed page, and the launch-blocked dialog. */
const App: FC = () => {
  const route = useRoute()
  const now = useNow()
  const [search, setSearch] = useState('')
  const health = useGetHealthQuery(undefined)
  const { data: apps = [], isError, isLoading } = useListAppsQuery(undefined)
  const { data: jobs = [] } = useListJobsQuery(undefined)
  const actions = useActions()

  const current = route.page === 'fleet' ? undefined : apps.find((app) => app.id === route.id)
  const blocked = apps.find((app) => app.id === actions.blocked?.app)
  const reason =
    actions.blocked === null || actions.blocked.reason === ''
      ? DASHBOARD_REASON
      : actions.blocked.reason

  const page = (): React.ReactNode => {
    if (route.page === 'fleet') {
      return (
        <FleetPage
          apps={apps}
          jobs={jobs}
          hostname={health.data?.hostname ?? null}
          search={search}
          now={now}
          actions={actions}
        />
      )
    }
    if (current === undefined) {
      return isLoading ? (
        <p className="m-0 text-ink-faint">Loading…</p>
      ) : (
        <p className="m-0">
          No app is called <code className="font-mono">{route.id}</code>.{' '}
          <a href={hrefOf({ page: 'fleet' })}>Back to the fleet</a>
        </p>
      )
    }
    if (route.page === 'config') return <ConfigPage key={current.id} app={current} />
    return <AppPage key={current.id} app={current} jobs={jobs} now={now} actions={actions} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-ink">
      <Header search={search} onSearch={setSearch} hostname={health.data?.hostname ?? null} />
      <div className="flex flex-1">
        <Sidebar apps={apps} route={route} />
        <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 pt-8 pb-12">
          <div className="mx-auto flex w-full max-w-content flex-col gap-6">
            {isError ? (
              <p
                role="alert"
                className="m-0 rounded-md bg-status-error-soft px-5 py-3 text-sm text-status-error"
              >
                The supervisor is not answering on this page’s origin. Start it with{' '}
                <code className="font-mono">npm run dev</code>.
              </p>
            ) : null}
            {actions.error === null ? null : (
              <div
                role="alert"
                className="flex items-center gap-3 rounded-md bg-status-error-soft px-5 py-3 text-sm text-status-error"
              >
                <span className="flex-1">{actions.error}</span>
                <button type="button" onClick={actions.dismiss} className="font-medium underline">
                  Dismiss
                </button>
              </div>
            )}
            {page()}
          </div>
        </main>
      </div>
      {blocked?.ok === true ? (
        <BusyDialog
          app={blocked}
          now={now}
          onCancel={actions.dismiss}
          onWait={() => {
            void actions.run(blocked.id, [{ action: 'up', reason, wait: true }])
          }}
          onTakeOver={() => {
            void actions.run(blocked.id, [
              { action: 'down', force: true },
              { action: 'up', reason }
            ])
          }}
        />
      ) : null}
    </div>
  )
}

export default App
