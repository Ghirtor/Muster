import type { FC } from 'react'

import type { PortRow } from '../../api/musterApi.types'

type PortsGridProps = Readonly<{ ports: PortRow[] }>

/** The ports that are listening right now, each with the process that owns it. */
const PortsGrid: FC<PortsGridProps> = ({ ports }) => {
  const listening = ports.filter((row) => row.up).sort((a, b) => a.port - b.port)

  if (listening.length === 0) {
    return <p className="m-0 px-5 pb-5 text-sm text-ink-faint">No port is listening.</p>
  }

  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2 px-5 pt-0 pb-4">
      {listening.map((row) => (
        <li key={row.port} className="rounded-sm bg-surface-sunken px-3 py-2.5">
          <div className="font-mono text-sm font-medium">{row.port}</div>
          <div className="truncate text-xs text-ink-muted">{row.label}</div>
        </li>
      ))}
    </ul>
  )
}

export default PortsGrid
