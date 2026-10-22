import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { loadConfig } from '../engine/config'
import { Rig } from '../engine/rig'
import { probe } from '../probe'
import { createSupervisor } from './supervisor'
import type { Supervisor } from './supervisor.types'

const SERVER = `
const net = require('node:net')
const port = Number(process.argv[2])
console.log('starting on ' + port)
setTimeout(() => net.createServer().listen(port, '127.0.0.1'), 200)
`

interface Answer {
  status: number
  body: unknown
}

type Message = Record<string, unknown>

let dir: string
let supervisor: Supervisor
let base: string
let files: string[]

/** A port nothing listens on, from the OS rather than a guess, so no Demo port is ever taken. */
const freePort = async (): Promise<number> => {
  const server = net.createServer()
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address() as AddressInfo
  await new Promise((resolve) => server.close(resolve))
  return port
}

/** One HTTP request to the supervisor, its JSON answer parsed. */
const call = async (
  method: string,
  url: string,
  body?: unknown,
  headers: http.OutgoingHttpHeaders = {}
): Promise<Answer> =>
  await new Promise((resolve, reject) => {
    const request = http.request(
      `${base}${url}`,
      {
        method,
        headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers }
      },
      (response) => {
        let text = ''
        response.on('data', (chunk: Buffer) => (text += chunk.toString()))
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body: text === '' ? null : JSON.parse(text) })
        })
      }
    )
    request.on('error', reject)
    request.end(body === undefined ? undefined : JSON.stringify(body))
  })

/** Polls `read` until it returns something, or fails after `timeoutMs`. */
const until = async <T>(
  read: () => T | undefined | Promise<T | undefined>,
  timeoutMs = 30_000
): Promise<T> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await read()
    if (value !== undefined) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('timed out')
}

/** A WebSocket client that keeps every message it receives. */
const connect = async (): Promise<{ socket: WebSocket; messages: Message[] }> => {
  const socket = new WebSocket(`${base.replace('http', 'ws')}/api/ws`)
  const messages: Message[] = []
  socket.addEventListener('message', (event) => {
    messages.push(JSON.parse(String(event.data)) as Message)
  })
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve)
    socket.addEventListener('error', reject)
  })
  return { socket, messages }
}

/** Writes a config file into the temp dir. */
const writeConfig = (file: string, config: object): string => {
  fs.writeFileSync(path.join(dir, file), JSON.stringify(config))
  return path.join(dir, file)
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flotilla-api-'))
  fs.writeFileSync(path.join(dir, 'server.js'), SERVER)
  const [fixturePort, queuedPort] = [await freePort(), await freePort()]
  files = [
    writeConfig('fixture.yaml', {
      name: 'Fixture',
      repo: dir,
      instances: { mode: 'one-per-checkout', lock: path.join(dir, 'locks', 'lock.json') },
      processes: [
        { key: 'web', label: 'Web', ports: [fixturePort], cmd: `node server.js ${fixturePort}` }
      ],
      ready: [{ ports: 'all', timeout: '20s' }],
      logs: path.join(dir, 'logs', '{key}.log')
    }),
    writeConfig('machine.yaml', {
      name: 'Machine',
      repo: dir,
      instances: { mode: 'one-per-machine', lock: path.join(dir, 'machine.json') },
      processes: [{ key: 'web', ports: [queuedPort], cmd: `node server.js ${queuedPort}` }],
      logs: path.join(dir, 'machine-logs', '{key}.log')
    }),
    writeConfig('broken.yaml', { name: 'Broken' })
  ]
  supervisor = await createSupervisor({
    configs: files,
    cli: [process.execPath, '--import', 'tsx', path.resolve('src/server/cli.ts')],
    hub: { statusMs: 200, logMs: 100 }
  })
  await new Promise<void>((resolve) => {
    supervisor.server.listen(0, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${(supervisor.server.address() as AddressInfo).port}`
})

afterEach(async () => {
  await supervisor.close()
  const out = { write: () => undefined }
  for (const file of files.slice(0, 2)) {
    const config = loadConfig(file)
    await new Rig(config, { repo: dir, reason: '', wait: false, force: true, out }).down(true)
  }
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('supervisor API', () => {
  it('lists every app, a broken config with its problems', async () => {
    const apps = await call('GET', '/api/apps')

    expect(apps.status).toBe(200)
    expect(apps.body).toEqual([
      expect.objectContaining({
        id: 'fixture',
        ok: true,
        snapshot: expect.objectContaining({
          state: 'down',
          listening: 0,
          total: 1,
          holders: []
        }) as unknown
      }),
      expect.objectContaining({ id: 'machine', ok: true }),
      expect.objectContaining({ id: 'broken', ok: false, problems: [expect.any(String)] })
    ])
    await expect(call('GET', '/api/apps/fixture/config')).resolves.toMatchObject({
      status: 200,
      body: { file: files[0], problems: null }
    })
    await expect(call('GET', '/api/apps/nobody')).resolves.toMatchObject({ status: 404 })
  })

  it('refuses other sites and malformed actions', async () => {
    await expect(
      call('GET', '/api/apps', undefined, { origin: 'http://evil.example' })
    ).resolves.toMatchObject({ status: 403 })
    await expect(
      call('GET', '/api/apps', undefined, { host: 'evil.example' })
    ).resolves.toMatchObject({ status: 403 })
    await expect(
      call('GET', '/api/apps', undefined, { origin: 'http://localhost:4870' })
    ).resolves.toMatchObject({ status: 200 })
    await expect(
      call('POST', '/api/apps/fixture/actions', { action: 'restart' })
    ).resolves.toMatchObject({ status: 400, body: { error: 'action must be up, down or release' } })
    await expect(
      call('POST', '/api/apps/fixture/actions', undefined, { 'content-type': 'text/plain' })
    ).resolves.toMatchObject({ status: 415 })
    await expect(call('POST', '/api/apps/broken/actions', { action: 'up' })).resolves.toMatchObject(
      {
        status: 409
      }
    )
  })

  it('validates a config without saving it', async () => {
    await expect(
      call('POST', '/api/apps/fixture/config/validate', { text: 'name: X\n' })
    ).resolves.toMatchObject({ status: 200, body: { ok: false, problems: [expect.any(String)] } })
    await expect(
      call('PUT', '/api/apps/fixture/config', { text: 'name: X\n' })
    ).resolves.toMatchObject({ status: 422 })
  })

  it('runs actions as CLI jobs and streams status, output and logs', async () => {
    const { socket, messages } = await connect()
    socket.send(JSON.stringify({ type: 'subscribe', topics: ['status', 'jobs', 'nonsense'] }))
    await until(() => messages.find((m) => m.type === 'status' && m.app === 'fixture'))
    expect(messages).toContainEqual({ type: 'error', message: 'unknown topic nonsense' })

    const up = await call('POST', '/api/apps/fixture/actions', { action: 'up', reason: 'api test' })
    expect(up).toMatchObject({
      status: 202,
      body: { app: 'fixture', action: 'up', state: 'running' }
    })
    const id = (up.body as { id: string }).id
    await expect(
      call('POST', '/api/apps/fixture/actions', { action: 'down' })
    ).resolves.toMatchObject({
      status: 409
    })

    const ended = await until(() =>
      messages.find((m) => m.type === 'job' && (m.job as Message).state === 'done')
    )
    const output = messages
      .filter((m) => m.type === 'job-output' && m.id === id)
      .map((m) => m.text)
      .join('')
    expect(output).toContain('rig up 1/1')
    expect(ended.job).toMatchObject({ id, exitCode: 0, outcome: 'ok' })
    await expect(call('GET', `/api/jobs/${id}`)).resolves.toMatchObject({
      status: 200,
      body: { output: expect.stringContaining('Web ... starting ... up') as unknown }
    })

    await until(() =>
      messages.find(
        (m) => m.type === 'status' && m.app === 'fixture' && (m.snapshot as Message).state === 'up'
      )
    )
    await expect(call('GET', '/api/apps/fixture/lock')).resolves.toMatchObject({
      body: { mode: 'one-per-checkout', holders: [expect.objectContaining({ reason: 'api test' })] }
    })

    socket.send(JSON.stringify({ type: 'subscribe', topics: ['log:fixture:web'] }))
    const log = await until(() => messages.find((m) => m.type === 'log'))
    expect(log).toMatchObject({ app: 'fixture', key: 'web', reset: true })
    expect(log.text).toContain('starting on')
    await expect(call('GET', '/api/apps/fixture/logs/web')).resolves.toMatchObject({
      body: { key: 'web', text: expect.stringContaining('starting on') as unknown }
    })

    const release = await call('POST', '/api/apps/fixture/actions', { action: 'release' })
    expect(release.status).toBe(202)
    const released = await until(() =>
      messages.find(
        (m) =>
          m.type === 'job' &&
          (m.job as Message).id === (release.body as { id: string }).id &&
          (m.job as Message).state === 'done'
      )
    )
    expect(released.job).toMatchObject({ outcome: 'ok' })
    const { snapshot } = (await call('GET', '/api/apps/fixture')).body as { snapshot: Message }
    expect(snapshot).toMatchObject({ state: 'down', holders: [] })
    socket.close()
  }, 60_000)

  it('cancels an action waiting in the queue', async () => {
    const holder = {
      repo: path.join(dir, 'theirs'),
      branch: 'main',
      reason: 'busy',
      since: new Date().toISOString(),
      pids: [process.pid]
    }
    fs.writeFileSync(path.join(dir, 'machine.json'), JSON.stringify(holder))

    const up = await call('POST', '/api/apps/machine/actions', { action: 'up', wait: true })
    const id = (up.body as { id: string }).id
    const queue = await until(async () => {
      const answer = await call('GET', '/api/apps/machine/queue')
      return (answer.body as unknown[]).length > 0 ? answer.body : undefined
    })
    expect(queue).toEqual([expect.objectContaining({ repo: dir })])

    await expect(call('DELETE', `/api/jobs/${id}`)).resolves.toMatchObject({ status: 200 })
    const job = await until(async () => {
      const answer = (await call('GET', `/api/jobs/${id}`)).body as { job: Message }
      return answer.job.endedAt === null ? undefined : answer.job
    })
    expect(job).toMatchObject({ state: 'cancelled', outcome: 'cancelled' })
    await expect(call('DELETE', `/api/jobs/${id}`)).resolves.toMatchObject({ status: 409 })
    await expect(
      probe(
        loadConfig(files[1] ?? '')
          .processes.at(0)
          ?.ports.at(0) ?? 0
      )
    ).resolves.toBe(false)
  }, 60_000)
})
