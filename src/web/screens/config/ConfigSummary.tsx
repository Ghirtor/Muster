import type { FC } from 'react'

import type { ConfigView, InstanceMode } from '../../api/flotillaApi.types'
import Panel from '../../components/Panel'
import { duration, modeLabel } from '../../format'

type ConfigSummaryProps = Readonly<{ config: ConfigView }>

const MODE_NOTES: Record<InstanceMode, string> = {
  'one-per-machine':
    'Fixed ports and shared data: checkouts take turns through the lock and queue.',
  'one-per-checkout': 'Each checkout runs its own instance.',
  'up-to-n': 'Any caller, until the limit.'
}

const FIELD = 'flex flex-col gap-1 text-[13px] text-ink-faint'
const VALUE = 'rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink'
const CHIP = 'rounded-xs bg-surface-sunken px-1.5 py-px font-mono text-[13px] text-ink'

/** The saved config read back as the dashboard understands it: general rules, processes, readiness. */
const ConfigSummary: FC<ConfigSummaryProps> = ({ config }) => {
  const { instances } = config
  const labelOf = (key: string): string =>
    config.processes.find((proc) => proc.key === key)?.label ?? key

  return (
    <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-6">
      <Panel title="General" labelledBy="general-heading">
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <div className={FIELD}>
              Name
              <span className={VALUE}>{config.name}</span>
            </div>
            <div className={FIELD}>
              Default checkout
              <span className={`${VALUE} font-mono text-[13px] [overflow-wrap:anywhere]`}>
                {config.repo}
              </span>
            </div>
          </div>
          <div className="rounded-sm border border-line-subtle bg-surface-sunken px-4 py-3">
            <div className="text-[13px] text-ink-faint">How many can run at once</div>
            <div className="mt-1 text-[15px] font-medium">
              {modeLabel(instances.mode, instances.max)}
            </div>
            <div className="text-[13px] text-ink-muted">{MODE_NOTES[instances.mode]}</div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <div className={FIELD}>
              Lock file
              <span className={`${VALUE} font-mono text-[13px] [overflow-wrap:anywhere]`}>
                {instances.lock}
              </span>
            </div>
            <div className={FIELD}>
              Lock frees itself after
              <span className={VALUE}>{duration(instances.staleAfterMs)} untouched</span>
            </div>
            <div className={FIELD}>
              When busy
              <span className={VALUE}>
                {instances.whenBusy === 'wait'
                  ? 'Join the queue (--wait)'
                  : 'Fail and say who holds it (exit 3)'}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-faint">
              Stopping — kill each port’s owning process tree, then these images by name
            </span>
            <div className="flex flex-wrap gap-2">
              {instances.killImages.length === 0 ? (
                <span className="text-sm text-ink-faint">None</span>
              ) : (
                instances.killImages.map((image) => (
                  <code key={image} className={CHIP}>
                    {image}
                  </code>
                ))
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title={
          <>
            Required processes{' '}
            <span className="text-sm font-medium text-ink-faint">launch order</span>
          </>
        }
        labelledBy="required-heading"
      >
        <ol className="m-0 list-none p-0">
          {config.processes.map((proc, index) => (
            <li
              key={proc.key}
              className="flex items-baseline gap-3 border-t border-line-subtle px-5 py-3 text-sm"
            >
              <span className="w-5 shrink-0 text-ink-faint">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{proc.label}</span>
                <span className="font-mono text-xs break-all text-ink-muted">{proc.cmd}</span>
              </span>
              <span className="font-mono text-[13px]">
                {proc.ports.length === 0 ? '—' : proc.ports.join(', ')}
              </span>
              <span className="w-56 shrink-0 text-right text-[13px] text-ink-faint">
                {[
                  proc.after.length > 0 ? `after ${proc.after.map(labelOf).join(', ')}` : '',
                  proc.build === undefined ? '' : `${proc.build.group} build`,
                  proc.onFailure.length > 0 ? `${proc.onFailure.length} repair rule` : ''
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Ready means" labelledBy="ready-heading">
        <ul className="m-0 flex list-disc flex-col gap-2 px-5 pb-5 pl-10 text-sm">
          {config.ready.map((check) =>
            check.kind === 'ports' ? (
              <li key={`ports:${check.ports.join(',')}`}>
                Ports <code className={CHIP}>{check.ports.join(', ')}</code> accept a connection
              </li>
            ) : (
              <li key={`cdp:${check.port}`}>
                Through CDP on <code className={CHIP}>{check.port}</code>, the page shows{' '}
                {check.anyOf.map((text, at) => (
                  <span key={text}>
                    {at > 0 ? ' or ' : ''}
                    <code className={CHIP}>{text}</code>
                  </span>
                ))}
              </li>
            )
          )}
          {config.tools.map((tool) => (
            <li key={tool.key}>
              Tool available: <code className={CHIP}>{tool.probe}</code>
              {tool.onFailure.length > 0 ? (
                <span className="text-ink-faint"> — installs on failure</span>
              ) : null}
            </li>
          ))}
          {config.ready.length + config.tools.length === 0 ? (
            <li className="text-ink-faint">Nothing beyond launching.</li>
          ) : null}
        </ul>
      </Panel>
    </div>
  )
}

export default ConfigSummary
