import type http from 'node:http'

import type { HubOptions } from './hub.types'

export interface SupervisorOptions {
  home: string
  cli: string[]
  webRoot?: string
  origins?: string[]
  env?: NodeJS.ProcessEnv
  hub?: HubOptions
}

export interface Supervisor {
  server: http.Server
  close: () => Promise<void>
}
