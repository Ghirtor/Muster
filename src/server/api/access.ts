import type http from 'node:http'

import { Inject, Injectable } from '@nestjs/common'
import type { NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

import { SUPERVISOR_OPTIONS } from './supervisor.options'
import type { SupervisorOptions } from './supervisor.types'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])
export const DEFAULT_ORIGINS = ['http://localhost:4870', 'http://127.0.0.1:4870']

/** The hostname of a Host header, brackets kept for IPv6. */
const hostnameOf = (host: string): string => host.replace(/:\d+$/, '')

/**
 * Whether a request may reach the API. The supervisor only listens on loopback, but a web page can
 * still aim requests at it: a Host other than loopback is DNS rebinding, and a browser Origin
 * other than the dashboard's is another site. Tools that send no Origin, the CLI's peers, pass.
 */
export const allowed = (request: http.IncomingMessage, origins: string[]): boolean => {
  const host = request.headers.host ?? ''
  if (!LOOPBACK.has(hostnameOf(host))) return false
  const origin = request.headers.origin
  return origin === undefined || origins.includes(origin) || origin === `http://${host}`
}

/** Refuses, with 403, an API request from another site or through a rebound host name. */
@Injectable()
export class OriginMiddleware implements NestMiddleware {
  private readonly origins: string[]

  constructor(@Inject(SUPERVISOR_OPTIONS) options: SupervisorOptions) {
    this.origins = options.origins ?? DEFAULT_ORIGINS
  }

  /** Lets an allowed request through. */
  use(request: Request, response: Response, next: NextFunction): void {
    if (allowed(request, this.origins)) {
      next()
      return
    }
    response.status(403).json({ error: 'forbidden origin' })
  }
}
