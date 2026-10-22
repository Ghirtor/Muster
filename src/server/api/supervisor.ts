import 'reflect-metadata'
import type http from 'node:http'

import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'

import { serveDashboard } from '../dashboard'
import { DEFAULT_ORIGINS } from './access'
import { FailureFilter } from './failure'
import { Hub } from './hub'
import { Jobs } from './jobs'
import { OriginWsAdapter } from './origin.adapter'
import { SupervisorModule } from './supervisor.module'
import type { Supervisor, SupervisorOptions } from './supervisor.types'

/** Serves the built dashboard from `root` for every GET outside `/api`. */
const dashboard =
  (root: string) =>
  (request: Request, response: Response, next: NextFunction): void => {
    if (request.method === 'GET' && !request.path.startsWith('/api/')) {
      serveDashboard(root, request, response)
      return
    }
    next()
  }

/**
 * The supervisor's HTTP and WebSocket API over the apps in `options.configs`, initialised but not
 * listening. Reads are answered from the configs, the lock files and port probes; actions start
 * `flotilla` CLI jobs. With `webRoot` it also serves the built dashboard, so the page and the API
 * share one origin.
 */
export const createSupervisor = async (options: SupervisorOptions): Promise<Supervisor> => {
  const app = await NestFactory.create<NestExpressApplication>(
    SupervisorModule.forRoot(options),
    new ExpressAdapter(),
    { bodyParser: false, logger: ['error', 'warn'] }
  )
  app.disable('x-powered-by')
  app.setGlobalPrefix('api')
  app.useGlobalFilters(new FailureFilter())
  app.useWebSocketAdapter(new OriginWsAdapter(app, options.origins ?? DEFAULT_ORIGINS))
  if (options.webRoot !== undefined) app.use(dashboard(options.webRoot))
  await app.init()
  const server: http.Server = app.getHttpServer()

  const close = async (): Promise<void> => {
    app.get(Hub).close()
    app.get(Jobs).stopAll()
    server.closeAllConnections()
    await app.close()
  }

  return { server, close }
}
