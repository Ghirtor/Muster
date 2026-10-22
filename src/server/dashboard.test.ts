import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { resolveAsset, serveDashboard } from './dashboard'

describe('dashboard', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'muster-dashboard-'))
    fs.writeFileSync(path.join(root, 'index.html'), '<div id="root"></div>')
    fs.mkdirSync(path.join(root, 'assets'))
    fs.writeFileSync(path.join(root, 'assets', 'main.js'), 'console.log(1)')
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('resolves a built asset to its file', () => {
    expect(resolveAsset(root, '/assets/main.js?v=1')).toBe(path.join(root, 'assets', 'main.js'))
  })

  it('answers a dashboard route with index.html', () => {
    expect(resolveAsset(root, '/apps/demo')).toBe(path.join(root, 'index.html'))
    expect(resolveAsset(root, '/')).toBe(path.join(root, 'index.html'))
  })

  it('refuses a path that escapes the root', () => {
    expect(resolveAsset(root, '/..%2F..%2Fsecret.txt')).toBeNull()
  })

  it('serves files with their content type', async () => {
    const server = http.createServer((request, response) => {
      serveDashboard(root, request, response)
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('no port')

    const asset = await fetch(`http://127.0.0.1:${address.port}/assets/main.js`)
    const route = await fetch(`http://127.0.0.1:${address.port}/apps/demo`)

    expect(asset.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    await expect(asset.text()).resolves.toBe('console.log(1)')
    await expect(route.text()).resolves.toBe('<div id="root"></div>')

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
  })
})
