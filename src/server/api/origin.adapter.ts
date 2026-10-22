import type http from 'node:http'

import type { INestApplicationContext } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'

import { allowed } from './access'

/**
 * Nest's ws adapter, refusing an upgrade (403) from another site or through a rebound host name,
 * as `OriginMiddleware` refuses an HTTP request: a WebSocket is not bound by CORS either.
 */
export class OriginWsAdapter extends WsAdapter {
  /** An adapter over `app` letting in only `origins`. */
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[]
  ) {
    super(app)
  }

  /** The server for one gateway, with the origin check in its handshake. */
  override create(
    port: number,
    options?: Record<string, unknown>
  ): ReturnType<WsAdapter['create']> {
    return super.create(port, {
      ...options,
      verifyClient: (
        info: { req: http.IncomingMessage },
        done: (ok: boolean, code?: number) => void
      ) => {
        done(allowed(info.req, this.origins), 403)
      }
    })
  }
}
