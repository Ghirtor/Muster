import type { FC } from 'react'

/** Muster's mark: three hulls in formation. */
const Logo: FC = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
    <rect x="1" y="3" width="10" height="20" rx="4" className="fill-brand-bright" />
    <rect x="13" y="3" width="12" height="9" rx="4" className="fill-chip-hover" />
    <rect x="13" y="14" width="12" height="9" rx="4" className="fill-ink-on-fill" />
  </svg>
)

export default Logo
