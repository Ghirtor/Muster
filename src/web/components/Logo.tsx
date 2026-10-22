import type { FC } from 'react'

const STEPS = [0, 1, 2, 3, 4]

const LIT = new Set([
  '0,0',
  '0,1',
  '0,2',
  '0,3',
  '0,4',
  '1,1',
  '3,1',
  '4,0',
  '4,1',
  '4,2',
  '4,3',
  '4,4'
])

const HEART = '2,2'

/** The class that paints the dot at `column`, `row`: the M's ranks, its meeting point, or the field. */
const fillOf = (column: number, row: number): string => {
  const key = `${column},${row}`
  if (key === HEART) return 'fill-brand-mark'
  return LIT.has(key) ? 'fill-ink-on-fill' : 'fill-brand'
}

/** Muster's mark: an M mustered out of a field of dots, drawn for the `brand-deep` top bar. */
const Logo: FC = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
    {STEPS.flatMap((column) =>
      STEPS.map((row) => (
        <circle
          key={`${column},${row}`}
          cx={3 + column * 5}
          cy={3 + row * 5}
          r="2"
          className={fillOf(column, row)}
        />
      ))
    )}
  </svg>
)

export default Logo
