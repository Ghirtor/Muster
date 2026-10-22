import { useEffect, useRef, useState } from 'react'
import type { FC } from 'react'

import type { ReadyApp } from '../../api/musterApi.types'
import Button from '../../components/Button'
import Icon from '../../components/Icon'
import { baseName, knownBranch, since } from '../../format'

type BusyDialogProps = Readonly<{
  app: ReadyApp
  now: number
  onCancel: VoidFunction
  onWait: VoidFunction
  onTakeOver: VoidFunction
}>

type Choice = 'wait' | 'take'

const TERM = 'w-24 shrink-0 text-ink-faint'
const ROW = 'flex gap-3 border-b border-surface px-4 py-3 last:border-b-0'

/**
 * Shown when a launch finds the rig held by another checkout (or by processes Muster did not
 * start): wait in the queue for it, or stop it and take it over. Escape cancels.
 */
const BusyDialog: FC<BusyDialogProps> = ({ app, now, onCancel, onWait, onTakeOver }) => {
  const [choice, setChoice] = useState<Choice>('wait')
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  useEffect(() => {
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('keydown', close)
    }
  }, [onCancel])

  const holder = app.snapshot.holders.at(0)
  const { listening, total } = app.snapshot

  const option = (value: Choice): string =>
    `flex cursor-pointer gap-3 rounded-md p-3.5 ${choice === value ? `border-2 ${value === 'take' ? 'border-status-error' : 'border-brand'} bg-brand-soft` : 'border border-line bg-surface'}`

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-scrim p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="busy-heading"
        aria-describedby="busy-description"
        className="flex w-full max-w-[560px] flex-col gap-5 rounded-md bg-material-sheet p-8 shadow-elevation-2"
      >
        <div className="flex items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-status-warn-soft text-status-warn">
            <Icon name="lock" size={20} />
          </span>
          <div className="flex-1">
            <h2
              id="busy-heading"
              className="m-0 text-xl leading-[1.3] font-semibold tracking-[-0.01em]"
            >
              {holder === undefined
                ? `${app.config.name} is already running outside Muster`
                : `${app.config.name} is held by another checkout`}
            </h2>
            <p
              id="busy-description"
              className="m-0 mt-1.5 text-[15px] leading-[1.55] text-ink-muted"
            >
              {holder === undefined
                ? 'Its ports are listening but no lock is recorded, so nobody can be queued behind it.'
                : `Only ${app.config.instances.mode === 'up-to-n' ? app.config.instances.max : 'one'} can run on this machine. You asked from ${baseName(app.config.repo)}.`}
            </p>
          </div>
        </div>

        {holder === undefined ? null : (
          <dl className="m-0 rounded-md bg-surface-sunken text-sm">
            <div className={ROW}>
              <dt className={TERM}>Held by</dt>
              <dd className="m-0 font-semibold">
                {baseName(holder.repo)}
                {knownBranch(holder.branch) === '' ? null : (
                  <>
                    {' '}
                    · <span className="font-mono text-[13px] font-normal">{holder.branch}</span>
                  </>
                )}
              </dd>
            </div>
            <div className={ROW}>
              <dt className={TERM}>Reason</dt>
              <dd className="m-0">{holder.reason || '—'}</dd>
            </div>
            <div className={ROW}>
              <dt className={TERM}>Held for</dt>
              <dd className="m-0">
                {since(holder.since, now)} ·{' '}
                <span className={listening === total ? 'text-status-ok' : 'text-ink-muted'}>
                  {listening} of {total} up
                </span>
              </dd>
            </div>
          </dl>
        )}

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] font-medium text-ink-muted">
            What should happen
          </legend>
          {holder === undefined ? null : (
            <label className={option('wait')}>
              <input
                ref={firstRef}
                type="radio"
                name="busy"
                checked={choice === 'wait'}
                onChange={() => {
                  setChoice('wait')
                }}
                className="m-0 mt-0.5 size-[18px] accent-brand"
              />
              <span>
                <span className="block text-[15px] font-semibold">Wait in the queue</span>
                <span className="mt-0.5 block text-[13px] text-ink-muted">
                  {app.snapshot.queue.length === 0
                    ? 'You are first in line.'
                    : `${app.snapshot.queue.length} ahead of you.`}{' '}
                  It launches from your checkout as soon as it is released.
                </span>
              </span>
            </label>
          )}
          <label className={option('take')}>
            <input
              ref={holder === undefined ? firstRef : undefined}
              type="radio"
              name="busy"
              checked={choice === 'take' || holder === undefined}
              onChange={() => {
                setChoice('take')
              }}
              className="m-0 mt-0.5 size-[18px] accent-status-error"
            />
            <span>
              <span className="block text-[15px] font-semibold text-status-error">
                Take it over now
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-muted">
                Stops every rig process and interrupts whoever is using it, then launches it here.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          {choice === 'wait' && holder !== undefined ? (
            <Button tone="primary" onClick={onWait}>
              Join queue
            </Button>
          ) : (
            <Button tone="danger" onClick={onTakeOver}>
              Take it over
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default BusyDialog
