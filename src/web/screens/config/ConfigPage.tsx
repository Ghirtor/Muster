import type { FC } from 'react'

import { useGetConfigQuery } from '../../api/flotillaApi'
import type { AppView } from '../../api/flotillaApi.types'
import ConfigForm from './ConfigForm'

type ConfigPageProps = Readonly<{ app: AppView }>

/** Loads an app's config text, then hands it to the editor. */
const ConfigPage: FC<ConfigPageProps> = ({ app }) => {
  const { data, isError } = useGetConfigQuery(app.id)

  if (isError) {
    return <p className="m-0 text-status-error">The config could not be read.</p>
  }
  if (data === undefined) {
    return <p className="m-0 text-ink-faint">Loading the config…</p>
  }
  return <ConfigForm key={app.file} app={app} file={data.file} text={data.text} />
}

export default ConfigPage
