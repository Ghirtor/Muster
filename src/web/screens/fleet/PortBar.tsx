import type { FC } from 'react'

import type { PortRow } from '../../api/flotillaApi.types'

type PortBarProps = Readonly<{ ports: PortRow[] }>

/** A pip per port, filled when it listens, with the count spelled out under it. */
const PortBar: FC<PortBarProps> = ({ ports }) => {
  const up = ports.filter((row) => row.up).length

  return (
    <>
      <div className="flex gap-[3px]" role="img" aria-label={`${up} of ${ports.length} ports up`}>
        {ports.map((row) => (
          <span
            key={row.port}
            title={`${row.port} ${row.label}`}
            className={`h-2 w-3.5 rounded-xs ${row.up ? 'bg-status-ok' : 'bg-line'}`}
          />
        ))}
      </div>
      <div className="mt-1 text-[13px] text-ink-faint">
        {up} of {ports.length} listening
      </div>
    </>
  )
}

export default PortBar
