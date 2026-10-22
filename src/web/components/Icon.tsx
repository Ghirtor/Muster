import type { FC, ReactNode } from 'react'

import type { IconName } from './Icon.types'

const PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3.5 3.5" />
    </>
  ),
  fleet: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1.5" />
      <rect x="9" y="2" width="5" height="5" rx="1.5" />
      <rect x="2" y="9" width="5" height="5" rx="1.5" />
      <rect x="9" y="9" width="5" height="5" rx="1.5" />
    </>
  ),
  plus: <path d="M8 2.5v11M2.5 8h11" />,
  monitor: (
    <>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
      <path d="M5 14.5h6" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </>
  ),
  check: <path d="M3 8.5l3.2 3L13 4.5" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  copy: (
    <>
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </>
  ),
  play: <path d="M5 3l8 5-8 5z" />,
  stop: <rect x="4" y="4" width="8" height="8" rx="1" />,
  restart: (
    <>
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M13 2.5v3h-3" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </>
  )
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

/** A line icon drawn in the text colour; decorative, so the control beside it carries the name. */
const Icon: FC<IconProps> = ({ name, size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`shrink-0 ${className}`}
  >
    {PATHS[name]}
  </svg>
)

export default Icon
