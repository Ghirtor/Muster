import http from 'node:http'
import type { AddressInfo } from 'node:net'
import vm from 'node:vm'

import { cdpShows, describeCheck, pageTargets, showsExpression, waitReady } from './ready'

describe('pageTargets', () => {
  it('keeps pages with a debugger socket, without DevTools', () => {
    const list = [
      { type: 'page', url: 'http://localhost:5173/', webSocketDebuggerUrl: 'ws://a' },
      { type: 'page', url: 'devtools://devtools/inspector.html', webSocketDebuggerUrl: 'ws://b' },
      { type: 'service_worker', url: 'http://x', webSocketDebuggerUrl: 'ws://c' },
      { type: 'page', url: 'http://y' }
    ]

    expect(pageTargets(list).map((t) => t.webSocketDebuggerUrl)).toEqual(['ws://a'])
  })

  it('reads anything but a list as no pages', () => {
    expect(pageTargets({ error: true })).toEqual([])
  })
})

describe('showsExpression', () => {
  const run = (text: string, anyOf: string[]): unknown =>
    vm.runInNewContext(showsExpression(anyOf), { document: { body: { innerText: text } } })

  it('names the first label the page shows', () => {
    expect(run('Connect a printer', ['Draw', 'Connect'])).toBe('Connect')
  })

  it('is null while none shows', () => {
    expect(run('Loading…', ['Draw', 'Connect'])).toBeNull()
  })
})

describe('describeCheck', () => {
  it('says what each check waits for', () => {
    expect(describeCheck({ kind: 'ports', ports: [1, 2], timeoutMs: 1 })).toBe('ports 1, 2')
    expect(describeCheck({ kind: 'cdp', port: 3, anyOf: ['Draw', 'Connect'], timeoutMs: 1 })).toBe(
      ':3 shows "Draw" or "Connect"'
    )
  })
})

describe('cdp readiness', () => {
  let server: http.Server
  let port: number

  beforeAll(async () => {
    server = http.createServer((_, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('[]')
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve)
    })
  })

  it('shows nothing while the endpoint lists no page', async () => {
    await expect(cdpShows(port, ['Draw'])).resolves.toBeNull()
  })

  it('times out when no page shows a label', async () => {
    const out = { text: '', write: (text: string): void => void (out.text += text) }

    await expect(
      waitReady({ kind: 'cdp', port, anyOf: ['Draw'], timeoutMs: 200 }, out, 50)
    ).resolves.toBe(false)
    expect(out.text).toBe(`  ready: :${port} shows "Draw" ... TIMEOUT\n`)
  })

  it('passes a ports check once they listen', async () => {
    const out = { text: '', write: (text: string): void => void (out.text += text) }

    await expect(
      waitReady({ kind: 'ports', ports: [port], timeoutMs: 200 }, out, 50)
    ).resolves.toBe(true)
    expect(out.text).toBe(`  ready: ports ${port} ... ok\n`)
  })
})
