import { useState } from 'react'
import type { FC } from 'react'

import { useSaveConfigMutation, useValidateConfigMutation } from '../../api/musterApi'
import type { ApiFailure, AppView } from '../../api/musterApi.types'
import Button from '../../components/Button'
import { baseName } from '../../format'
import { hrefOf } from '../../routes'
import { appName } from '../appStatus'
import ConfigSummary from './ConfigSummary'

type ConfigFormProps = Readonly<{ app: AppView; file: string; text: string }>

type Verdict = { ok: true; message: string } | { ok: false; message: string; problems: string[] }

/** The problems a failed save or validation carries. */
const problemsOf = (caught: unknown): Verdict => {
  const failure = caught as Partial<ApiFailure>
  return {
    ok: false,
    message: failure.message ?? 'The supervisor refused the config',
    problems: failure.problems ?? []
  }
}

/**
 * The config file as text, beside what the saved config means. Validate checks the text without
 * saving; Save writes it and reloads the app, whose id follows its name.
 */
const ConfigForm: FC<ConfigFormProps> = ({ app, file, text }) => {
  const [draft, setDraft] = useState(text)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [validate, validation] = useValidateConfigMutation()
  const [save, saving] = useSaveConfigMutation()

  const pending = validation.isLoading || saving.isLoading

  const handleValidate = async (): Promise<void> => {
    try {
      const result = await validate({ app: app.id, text: draft }).unwrap()
      setVerdict(
        result.ok
          ? { ok: true, message: 'The config is valid. Nothing was saved.' }
          : { ok: false, message: 'The config has problems', problems: result.problems }
      )
    } catch (caught) {
      setVerdict(problemsOf(caught))
    }
  }

  const handleSave = async (): Promise<void> => {
    try {
      const saved = await save({ app: app.id, text: draft }).unwrap()
      setVerdict({ ok: true, message: `Saved ${baseName(file)}.` })
      if (saved.id !== app.id) window.location.hash = hrefOf({ page: 'config', id: saved.id })
    } catch (caught) {
      setVerdict(problemsOf(caught))
    }
  }

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(draft)
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-faint">
        <a href={hrefOf({ page: 'fleet' })}>Fleet</a> <span aria-hidden="true">/</span>{' '}
        <a href={hrefOf({ page: 'app', id: app.id })}>{appName(app)}</a>{' '}
        <span aria-hidden="true">/</span> Config
      </nav>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-[1_1_320px]">
          <h1 className="m-0 text-[30px] leading-tight font-semibold tracking-[-0.015em]">
            {appName(app)} config
          </h1>
          <p className="m-0 mt-1.5 text-[15px] text-ink-muted">
            Saved in <code className="font-mono text-[13px] [overflow-wrap:anywhere]">{file}</code>
          </p>
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            void handleValidate()
          }}
        >
          Validate
        </Button>
        <Button
          tone="primary"
          disabled={pending || draft === text}
          onClick={() => {
            void handleSave()
          }}
        >
          Save config
        </Button>
      </div>

      {verdict === null ? null : (
        <div
          role={verdict.ok ? 'status' : 'alert'}
          className={`rounded-md px-5 py-3 text-sm ${verdict.ok ? 'bg-status-ok-soft text-status-ok' : 'bg-status-error-soft text-status-error'}`}
        >
          <p className="m-0 font-medium">{verdict.message}</p>
          {verdict.ok || verdict.problems.length === 0 ? null : (
            <ul className="m-0 mt-1 pl-5">
              {verdict.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        {app.ok ? (
          <ConfigSummary config={app.config} />
        ) : (
          <div className="flex-[3_1_520px] rounded-md bg-status-error-soft px-5 py-4 text-sm text-status-error">
            <p className="m-0 font-medium">The saved config does not load</p>
            <ul className="m-0 mt-1 pl-5">
              {app.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}

        <aside
          aria-labelledby="yaml-heading"
          className="min-w-0 flex-[2_1_380px] overflow-hidden rounded-md bg-surface shadow-elevation-1"
        >
          <div className="flex items-center gap-3 bg-surface-accent px-5 py-3.5">
            <h2 id="yaml-heading" className="m-0 flex-1 truncate font-mono text-sm font-medium">
              {baseName(file)}
            </h2>
            <Button small onClick={handleCopy}>
              Copy
            </Button>
          </div>
          <label className="sr-only" htmlFor="config-text">
            Config text
          </label>
          <textarea
            id="config-text"
            value={draft}
            spellCheck={false}
            onChange={(event) => {
              setDraft(event.target.value)
              setVerdict(null)
            }}
            className="m-4 box-border block min-h-[560px] w-[calc(100%-2rem)] resize-y rounded-md bg-console px-[18px] py-4 font-mono text-[12.5px] leading-[1.65] whitespace-pre text-console-ink outline-none focus-visible:outline-2 focus-visible:outline-focus-ring"
          />
        </aside>
      </div>
    </>
  )
}

export default ConfigForm
