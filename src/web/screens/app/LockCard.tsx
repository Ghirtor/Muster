import type { FC } from 'react'

import type { ReadyApp } from '../../api/musterApi.types'
import { baseName, clock, duration, knownBranch, since } from '../../format'

type LockCardProps = Readonly<{ app: ReadyApp; now: number }>

const ROW = 'flex gap-3 border-b border-line-subtle px-4 py-3 last:border-b-0'
const TERM = 'w-[104px] shrink-0 text-ink-faint'

/** Who holds the rig, from which checkout and branch, why, for how long, and when it frees itself. */
const LockCard: FC<LockCardProps> = ({ app, now }) => {
  const { holders, foreign } = app.snapshot
  const stale = duration(app.config.instances.staleAfterMs)

  if (holders.length === 0) {
    return (
      <p className="m-0 rounded-md bg-surface px-4 py-3 text-sm text-ink-muted shadow-elevation-1">
        {foreign
          ? 'Ports are listening but no lock is recorded: the rig was started outside Muster.'
          : 'Nobody holds the rig. Launching it takes the lock.'}
      </p>
    )
  }

  return (
    <>
      {holders.map((lock) => (
        <dl
          key={`${lock.repo}-${lock.since}`}
          className="m-0 rounded-md bg-surface text-sm shadow-elevation-1"
        >
          <div className={ROW}>
            <dt className={TERM}>Held by</dt>
            <dd className="m-0 font-semibold">
              {baseName(lock.repo)}{' '}
              <span className="font-normal text-ink-faint">
                {lock.mine ? 'this checkout' : 'another checkout'}
              </span>
            </dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Checkout</dt>
            <dd className="m-0 min-w-0 font-mono text-[13px] [overflow-wrap:anywhere]">
              {lock.repo}
            </dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Branch</dt>
            <dd className="m-0 font-mono text-[13px]">{knownBranch(lock.branch) || '—'}</dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Reason</dt>
            <dd className="m-0">{lock.reason || '—'}</dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Held for</dt>
            <dd className="m-0 tabular-nums">
              {since(lock.since, now)}{' '}
              <span className="text-ink-faint">since {clock(lock.since)}</span>
            </dd>
          </div>
          <div className={ROW}>
            <dt className={TERM}>Frees itself</dt>
            <dd className="m-0 text-ink-muted">
              When every launched process is gone and no port listens, or after {stale} untouched
            </dd>
          </div>
        </dl>
      ))}
    </>
  )
}

export default LockCard
