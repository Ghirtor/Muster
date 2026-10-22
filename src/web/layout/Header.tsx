import { useEffect, useRef } from 'react'
import type { FC } from 'react'

import Icon from '../components/Icon'
import Logo from '../components/Logo'

interface HeaderProps {
  search: string
  onSearch: (text: string) => void
  hostname: string | null
}

/** The top bar: brand, the app search (Ctrl K focuses it) and the machine the supervisor runs on. */
const Header: FC<HeaderProps> = ({ search, onSearch, hostname }) => {
  const fieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focus = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        fieldRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focus)
    return () => {
      window.removeEventListener('keydown', focus)
    }
  }, [])

  return (
    <header className="sticky top-0 z-20 flex h-header items-center gap-6 bg-brand-deep px-6 text-ink-on-fill shadow-elevation-1">
      <a href="#/" className="flex items-center gap-2.5 text-ink-on-fill no-underline">
        <Logo />
        <span className="font-display text-2xl tracking-tight">Muster</span>
      </a>
      <label className="flex h-10 w-full max-w-[520px] items-center gap-2.5 rounded-pill bg-material-window px-4">
        <Icon name="search" />
        <span className="sr-only">Search apps, processes, ports</span>
        <input
          ref={fieldRef}
          type="search"
          value={search}
          onChange={(event) => {
            onSearch(event.target.value)
          }}
          placeholder="Search apps, processes, ports"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-on-fill outline-none placeholder:text-chip-hover"
        />
        <kbd className="font-mono text-xs text-chip-hover">Ctrl K</kbd>
      </label>
      {hostname === null ? null : (
        <span className="ml-auto flex h-9 items-center gap-2 rounded-pill bg-material-window px-3.5 text-[13px] font-medium">
          <Icon name="monitor" size={14} />
          {hostname}
        </span>
      )}
    </header>
  )
}

export default Header
