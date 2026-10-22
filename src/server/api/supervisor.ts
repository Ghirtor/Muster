import http from 'node:http'
import os from 'node:os'

import { serveDashboard } from '../dashboard'
import { Hub } from './hub'
import { Jobs } from './jobs'
import type { Action, ActionRequest } from './jobs.types'
import { tailLog } from './logs'
import { Registry, validate } from './registry'
import type { AppEntry } from './registry.types'
import type { Reply, Supervisor, SupervisorOptions } from './supervisor.types'
import { configView } from './views'
import type { AppView } from './views.types'
import { acceptUpgrade } from './websocket'

const ACTIONS = new Set<Action>(['up', 'down', 'release'])
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])
const DEFAULT_ORIGINS = ['http://localhost:4870', 'http://127.0.0.1:4870']
const MAX_BODY = 1024 * 1024

/** A JSON error body. */
const failure = (status: number, error: string, extra: object = {}): Reply => [
  status,
  { error, ...extra }
]

/** The request body parsed as JSON; null when it is empty, too large or not JSON. */
const readBody = async (request: http.IncomingMessage): Promise<unknown> =>
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

/** An action request from a JSON body, or the reason it is not one. */
export const parseAction = (body: unknown): ActionRequest | string => {
  if (typeof body !== 'object' || body === null) return 'expected a JSON object'
  const raw = body as Record<string, unknown>
  if (!ACTIONS.has(raw.action as Action)) return 'action must be up, down or release'
  for (const name of ['repo', 'reason'] as const) {
    if (raw[name] !== undefined && typeof raw[name] !== 'string') return `${name} must be text`
  }
  for (const name of ['wait', 'force'] as const) {
    if (raw[name] !== undefined && typeof raw[name] !== 'boolean')
      return `${name} must be true or false`
  }
  return raw as unknown as ActionRequest
}

/** The `text` field of a JSON body, or null. */
const textOf = (body: unknown): string | null => {
  const text = (body as { text?: unknown } | null)?.text
  return typeof text === 'string' ? text : null
}

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

/**
 * The supervisor's HTTP and WebSocket API over the apps in `options.configs`. Reads are answered
 * from the configs, the lock files and port probes; actions start `flotilla` CLI jobs. With
 * `webRoot` it also serves the built dashboard, so the page and the API share one origin.
 */
export const createSupervisor = (options: SupervisorOptions): Supervisor => {
  const registry = new Registry(options.configs)
  const jobs = new Jobs(options.cli, options.env)
  const hub = new Hub(registry, jobs, options.hub)
  const origins = options.origins ?? DEFAULT_ORIGINS

  const viewOf = async (entry: AppEntry): Promise<AppView> => {
    if (entry.problems !== null) {
      return { id: entry.id, file: entry.file, ok: false, problems: entry.problems }
    }
    const snapshot = await registry.rigOf(entry).snapshot()
    return { id: entry.id, file: entry.file, ok: true, config: configView(entry.config), snapshot }
  }

  const appRoute = async (
    entry: AppEntry,
    rest: string,
    method: string,
    request: http.IncomingMessage,
    url: URL
  ): Promise<Reply> => {
    if (rest === '' && method === 'GET') return [200, await viewOf(entry)]
    if (rest === '/config' && method === 'GET') {
      return [200, { file: entry.file, text: registry.text(entry), problems: entry.problems }]
    }
    if (rest === '/config' && method === 'PUT') {
      const text = textOf(await readBody(request))
      if (text === null) return failure(400, 'expected {text}')
      const saved = registry.save(entry, text)
      if (!saved.ok) return failure(422, 'invalid config', { problems: saved.problems })
      const reloaded = registry.list().find((other) => other.file === entry.file) ?? entry
      return [200, await viewOf(reloaded)]
    }
    if (rest === '/config/validate' && method === 'POST') {
      const text = textOf(await readBody(request))
      if (text === null) return failure(400, 'expected {text}')
      const result = validate(text, entry.file)
      return [200, result.ok ? { ok: true, problems: [] } : result]
    }
    if (rest === '/actions' && method === 'POST') {
      if (entry.problems !== null) {
        return failure(409, 'the config does not load', { problems: entry.problems })
      }
      const parsed = parseAction(await readBody(request))
      if (typeof parsed === 'string') return failure(400, parsed)
      const started = jobs.start(entry, parsed)
      if (!started.ok) return failure(409, 'an action is already running', { job: started.running })
      return [202, started.job]
    }
    if (entry.problems !== null || method !== 'GET') return failure(404, 'not found')
    const rig = registry.rigOf(entry)
    if (rest === '/status') return [200, await rig.snapshot()]
    if (rest === '/lock') {
      const { holders, foreign } = await rig.snapshot()
      return [200, { mode: entry.config.instances.mode, holders, foreign }]
    }
    if (rest === '/queue') return [200, (await rig.snapshot()).queue]
    const log = /^\/logs\/([^/]+)$/.exec(rest)
    const key = decodeURIComponent(log?.at(1) ?? '')
    if (log !== null && entry.config.processes.some((p) => p.key === key)) {
      const bytes = Number(url.searchParams.get('bytes') ?? 64 * 1024)
      const file = rig.logOf(key)
      return [200, { key, file, ...tailLog(file, Number.isFinite(bytes) ? bytes : 64 * 1024) }]
    }
    return failure(404, 'not found')
  }

  const route = async (request: http.IncomingMessage, url: URL): Promise<Reply> => {
    const method = request.method ?? 'GET'
    const { pathname } = url
    if (
      (method === 'POST' || method === 'PUT') &&
      !(request.headers['content-type'] ?? '').includes('json')
    ) {
      return failure(415, 'send application/json')
    }
    if (pathname === '/api/health') return [200, { ok: true, hostname: os.hostname() }]
    if (pathname === '/api/apps' && method === 'GET') {
      return [200, await Promise.all(registry.list().map(viewOf))]
    }
    if (pathname === '/api/reload' && method === 'POST') {
      registry.reload()
      return [200, await Promise.all(registry.list().map(viewOf))]
    }
    const app = /^\/api\/apps\/([^/]+)(\/.*)?$/.exec(pathname)
    if (app !== null) {
      const entry = registry.get(decodeURIComponent(app.at(1) ?? ''))
      if (entry === null) return failure(404, 'no such app')
      return await appRoute(entry, app.at(2) ?? '', method, request, url)
    }
    if (pathname === '/api/jobs' && method === 'GET') return [200, jobs.list()]
    const job = /^\/api\/jobs\/([^/]+)$/.exec(pathname)
    const id = job?.at(1) ?? ''
    if (job !== null && method === 'GET') {
      const found = jobs.get(id)
      return found === null ? failure(404, 'no such job') : [200, found]
    }
    if (job !== null && method === 'DELETE') {
      if (jobs.get(id) === null) return failure(404, 'no such job')
      if (!jobs.cancel(id)) return failure(409, 'the job is not running')
      return [200, jobs.get(id)?.job]
    }
    return failure(404, 'not found')
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) {
      if (options.webRoot !== undefined && request.method === 'GET') {
        serveDashboard(options.webRoot, request, response)
      } else {
        response.writeHead(404).end()
      }
      return
    }
    if (!allowed(request, origins)) {
      response.writeHead(403, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'forbidden origin' }))
      return
    }
    route(request, url)
      .catch((error: unknown): Reply =>
        failure(500, error instanceof Error ? error.message : String(error))
      )
      .then(([status, body]) => {
        response.writeHead(status, { 'content-type': 'application/json' })
        response.end(JSON.stringify(body))
      })
      .catch(() => response.destroy())
  })

  server.on('upgrade', (request, socket) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== '/api/ws' || !allowed(request, origins)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    const peer = acceptUpgrade(request, socket)
    if (peer !== null) hub.add(peer)
  })

  const close = async (): Promise<void> => {
    hub.close()
    jobs.stopAll()
    server.closeAllConnections()
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
  }

  return { server, close }
}
