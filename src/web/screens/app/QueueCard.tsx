import type { FC } from 'react'

import type { QueueEntry } from '../../api/musterApi.types'
import { baseName, knownBranch, since } from '../../format'

type QueueCardProps = Readonly<{ queue: QueueEntry[]; now: number }>

/** The checkouts waiting for the rig, first in line first. */
const QueueCard: FC<QueueCardProps> = ({ queue, now }) => (
  <div className="rounded-md bg-surface shadow-elevation-1">
    <ol className="m-0 list-none p-0">
      {queue.map((entry, index) => (
        <li
          key={`${entry.pid}-${entry.since}`}
          className="flex items-center gap-3 border-b border-line-subtle px-4 py-3.5"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-pill bg-status-warn-soft text-[13px] font-semibold text-status-warn">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              {baseName(entry.repo)}
              {knownBranch(entry.branch) === '' ? null : (
                <>
                  {' '}
                  · <span className="font-mono text-[13px] font-normal">{entry.branch}</span>
                </>
              )}
            </div>
            <div className="text-[13px] text-ink-faint">
              {[entry.reason, `waiting ${since(entry.since, now)}`].filter(Boolean).join(' · ')}
            </div>
          </div>
        </li>
      ))}
    </ol>
    <p className="m-0 px-4 py-3.5 text-[13px] leading-normal text-ink-muted">
      {queue.length === 0
        ? 'Nobody is waiting. A launch while the rig is held can wait here for it.'
        : 'When the rig is released it goes to the next in line, which launches it from its checkout.'}
    </p>
  </div>
)

export default QueueCard
