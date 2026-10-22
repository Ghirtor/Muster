import { Catch, HttpException } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'

/** An API error: its body is `{error, ...extra}`, the shape the dashboard's client reads. */
export class ApiFailure extends HttpException {
  /** A failure answering `status` with `error` and any `extra` fields. */
  constructor(status: number, error: string, extra: object = {}) {
    super({ error, ...extra }, status)
  }
}

/** The status and body that answer `exception`. */
const replyOf = (exception: unknown): [number, object] => {
  if (exception instanceof ApiFailure)
    return [exception.getStatus(), exception.getResponse() as object]
  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    return [status, { error: status === 404 ? 'not found' : exception.message }]
  }
  return [500, { error: exception instanceof Error ? exception.message : String(exception) }]
}

/** Answers every error, Nest's own included, as `{error}` JSON. */
@Catch()
export class FailureFilter implements ExceptionFilter {
  /** Writes the error reply. */
  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return
    const [status, body] = replyOf(exception)
    host.switchToHttp().getResponse<Response>().status(status).json(body)
  }
}
