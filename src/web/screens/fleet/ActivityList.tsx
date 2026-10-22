import type { FC } from 'react'

import type { AppView, Job } from '../../api/flotillaApi.types'
import { clock } from '../../format'
import { hrefOf } from '../../routes'
import { appName } from '../appStatus'
import { jobText } from '../jobText'

type ActivityListProps = Readonly<{ jobs: Job[]; apps: AppView[]; limit?: number }>

/** The latest actions the supervisor ran, newest first. */
const ActivityList: FC<ActivityListProps> = ({ jobs, apps, limit = 8 }) => {
  const nameOf = (id: string): string => {
    const app = apps.find((other) => other.id === id)
    return app === undefined ? id : appName(app)
  }

  if (jobs.length === 0) {
    return <p className="m-0 px-5 pb-5 text-sm text-ink-faint">Nothing has run yet.</p>
  }

  return (
    <ol className="m-0 list-none p-0 pb-2">
      {jobs.slice(0, limit).map((job) => (
        <li
          key={job.id}
          className="flex items-baseline gap-3 border-t border-line-subtle px-5 py-3"
        >
          <span className="w-14 shrink-0 font-mono text-xs text-ink-faint">
            {clock(job.startedAt)}
          </span>
          <span className="flex-1 text-sm">
            <a
              href={hrefOf({ page: 'app', id: job.app })}
              className="font-semibold text-ink no-underline hover:text-brand"
            >
              {nameOf(job.app)}
            </a>
            : {jobText(job)}
            {job.args.includes('--reason') ? (
              <span className="text-ink-muted">
                {' '}
                — “{job.args.at(job.args.indexOf('--reason') + 1)}”
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default ActivityList
