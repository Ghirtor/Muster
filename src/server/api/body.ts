import { Injectable } from '@nestjs/common'
import type { NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

const MAX_BODY = 1024 * 1024

/** The request body parsed as JSON; null when it is empty, too large or not JSON. */
const readBody = async (request: Request): Promise<unknown> =>
  await new Promise((resolve) => {
    let size = 0
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size <= MAX_BODY) chunks.push(chunk)
    })
    request.on('end', () => {
      if (size > MAX_BODY) {
        resolve(null)
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(null)
      }
    })
    request.on('error', () => {
      resolve(null)
    })
  })

/**
 * Reads a POST or PUT body as JSON, refusing any other content type with 415. A body that does not
 * parse becomes null, so each route answers it with its own 400 rather than a generic one.
 */
@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  /** Sets `request.body`, then hands over. */
  use(request: Request, response: Response, next: NextFunction): void {
    if (request.method !== 'POST' && request.method !== 'PUT') {
      next()
      return
    }
    if (!(request.headers['content-type'] ?? '').includes('json')) {
      response.status(415).json({ error: 'send application/json' })
      return
    }
    void readBody(request).then((body) => {
      request.body = body
      next()
    })
  }
}
