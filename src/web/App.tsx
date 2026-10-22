import type { FC } from 'react'

import StatusBadge from './components/StatusBadge'

const App: FC = () => (
  <div className="flex min-h-screen flex-col">
    <header className="flex h-header items-center gap-4 bg-brand-deep px-6 text-ink-on-fill shadow-elevation-1">
      <span className="font-display text-2xl tracking-tight">Flotilla</span>
    </header>
    <main className="mx-auto flex w-full max-w-content flex-col gap-6 px-6 py-8">
      <h1 className="m-0 text-3xl font-semibold tracking-tight">Fleet</h1>
      <p className="m-0 text-ink-muted">
        Scaffold ready. The screens to build are in <code className="font-mono">design/</code>.
      </p>
      <div className="flex gap-2">
        <StatusBadge status="ok" />
        <StatusBadge status="warn" />
        <StatusBadge status="error" />
        <StatusBadge status="idle" />
      </div>
    </main>
  </div>
)

export default App
