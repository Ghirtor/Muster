import type { FC } from 'react'

import type { ReadyApp, ReadyCheck } from '../../api/flotillaApi.types'

type ReadinessCardProps = Readonly<{ app: ReadyApp }>

/** A key naming `check` among an app's checks. */
const checkKey = (check: ReadyCheck): string =>
  check.kind === 'ports' ? `ports:${check.ports.join(',')}` : `cdp:${check.port}`

/** One check's description and whether it passes now. */
const describe = (
  check: ReadyCheck,
  app: ReadyApp
): { label: string; value: string; ok: boolean } => {
  if (check.kind === 'ports') {
    const up = app.snapshot.ports.filter((row) => row.up && check.ports.includes(row.port)).length
    return {
      label: 'Ports accept a connection',
      value: `${up} of ${check.ports.length}`,
      ok: up === check.ports.length
    }
  }
  const ready = app.snapshot.state === 'up'
  return {
    label: `App UI is usable — ${check.anyOf.join(' or ')} on :${check.port}`,
    value: ready ? 'Ready' : 'Waiting',
    ok: ready
  }
}

/** The checks a launch waits on before it reports the app ready. */
const ReadinessCard: FC<ReadinessCardProps> = ({ app }) => (
  <ul className="m-0 list-none rounded-md bg-surface p-0 text-sm shadow-elevation-1">
    {app.config.ready.length === 0 ? (
      <li className="px-4 py-3 text-ink-faint">No readiness check: ready once launched.</li>
    ) : (
      app.config.ready.map((check) => {
        const { label, value, ok } = describe(check, app)
        return (
          <li
            key={checkKey(check)}
            className="flex items-center gap-2.5 border-b border-line-subtle px-4 py-3 last:border-b-0"
          >
            <span className="flex-1">{label}</span>
            <span className={`font-medium ${ok ? 'text-status-ok' : 'text-ink-faint'}`}>
              {value}
            </span>
          </li>
        )
      })
    )}
  </ul>
)

export default ReadinessCard
