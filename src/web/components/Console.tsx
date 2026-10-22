import { useEffect, useRef } from 'react'
import type { FC } from 'react'

type ConsoleProps = Readonly<{
  text: string
  label: string
  follow?: boolean
  empty?: string
  className?: string
}>

/** The tone of one log line, read from the words it carries. */
const toneOf = (line: string): string => {
  if (/\b(error|err!|fatal|failed|panic)\b/i.test(line)) return 'text-console-error'
  if (/\bwarn(ing)?\b/i.test(line)) return 'text-console-warn'
  if (/\b(ready|listening|accepts connections)\b/i.test(line)) return 'text-console-ok'
  return ''
}

/** A dark console well for log text; with `follow` it keeps the newest line in view. */
const Console: FC<ConsoleProps> = ({ text, label, follow = false, empty = '', className = '' }) => {
  const wellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = wellRef.current
    if (follow && node !== null) node.scrollTop = node.scrollHeight
  }, [text, follow])

  const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n')
  const starts = lines.map((_line, at) =>
    lines.slice(0, at).reduce((sum, previous) => sum + previous.length + 1, 0)
  )

  return (
    <div
      ref={wellRef}
      role="log"
      aria-label={label}
      tabIndex={0}
      className={`overflow-auto rounded-md bg-console px-[18px] py-4 font-mono text-[12.5px] leading-[1.65] whitespace-pre text-console-ink ${className}`}
    >
      {lines.length === 0 ? (
        <span className="text-console-muted">{empty}</span>
      ) : (
        lines.map((line, at) => (
          <div key={starts.at(at)} className={toneOf(line)}>
            {line === '' ? ' ' : line}
          </div>
        ))
      )}
    </div>
  )
}

export default Console
