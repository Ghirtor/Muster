import type { FC } from 'react'

import type { AppView } from '../api/flotillaApi.types'
import Icon from '../components/Icon'
import { hrefOf } from '../routes'
import type { Route } from '../routes.types'

interface SidebarProps {
  apps: AppView[]
  route: Route
}

const DOTS = {
  up: 'bg-status-ok',
  partial: 'bg-status-warn',
  down: 'border-[1.5px] border-status-idle',
  broken: 'bg-status-error'
}

const ROW =
  'relative flex h-11 items-center gap-3 rounded-sm px-3 text-[15px] font-medium text-ink no-underline hover:bg-brand-soft'

const SELECTED = 'bg-selected shadow-[inset_3px_0_0_var(--color-brand)] hover:bg-selected'

/** The app navigator: the fleet, then each app with how many of its ports listen. */
const Sidebar: FC<SidebarProps> = ({ apps, route }) => (
  <nav
    aria-label="Apps"
    className="flex w-sidebar shrink-0 flex-col gap-1 border-r border-line-subtle bg-surface px-3 py-6"
  >
    <a
      href={hrefOf({ page: 'fleet' })}
      aria-current={route.page === 'fleet' ? 'page' : undefined}
      className={`${ROW} ${route.page === 'fleet' ? SELECTED : ''}`}
    >
      <Icon name="fleet" />
      Fleet
    </a>
    <p className="m-0 mt-5 mb-1 px-3 text-[11px] font-semibold tracking-[0.07em] text-ink-faint uppercase">
      Apps
    </p>
    {apps.map((app) => {
      const current = route.page !== 'fleet' && route.id === app.id
      const dot = app.ok ? DOTS[app.snapshot.state] : DOTS.broken
      return (
        <a
          key={app.id}
          href={hrefOf({ page: 'app', id: app.id })}
          aria-current={current ? 'page' : undefined}
          className={`${ROW} ${current ? SELECTED : ''}`}
        >
          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
          <span className="min-w-0 flex-1 truncate">{app.ok ? app.config.name : app.id}</span>
          <span className="font-mono text-[13px] text-ink-faint">
            {app.ok ? `${app.snapshot.listening}/${app.snapshot.total}` : 'broken'}
          </span>
        </a>
      )
    })}
  </nav>
)

export default Sidebar
