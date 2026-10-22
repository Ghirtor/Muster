import type { FC, PropsWithChildren, ReactNode } from 'react'

type PanelProps = PropsWithChildren<{
  title?: ReactNode
  actions?: ReactNode
  className?: string
  labelledBy?: string
}>

/** A white card on the page ground, with an optional title row. */
const Panel: FC<PanelProps> = ({ title, actions, className = '', labelledBy, children }) => (
  <section
    aria-labelledby={labelledBy}
    className={`overflow-hidden rounded-md border border-line-subtle bg-surface shadow-elevation-1 ${className}`}
  >
    {title === undefined ? null : (
      <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3">
        <h2 id={labelledBy} className="m-0 text-[17px] leading-snug font-semibold tracking-tight">
          {title}
        </h2>
        {actions}
      </div>
    )}
    {children}
  </section>
)

export default Panel
