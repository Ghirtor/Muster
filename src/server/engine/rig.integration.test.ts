import fs from 'node:fs'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { probe } from '../probe'
import { parseRegistration, resolveApp } from './config'
import type { RigConfig } from './config.types'
import { Rig } from './rig'

/**
 * A process that listens on a port after a delay and stays up. With a marker file named, it first
 * exits with an install-failure signature unless the marker exists, as a missing venv would.
 */
const SERVER = `
const fs = require('node:fs')
const net = require('node:net')
const [port, delay, marker] = process.argv.slice(2)
if (marker === 'crash') { console.error('Segmentation fault'); process.exit(1) }
if (marker && !fs.existsSync(marker)) { console.error('MODULE_MISSING: install first'); process.exit(1) }
console.log('starting on ' + port)
setTimeout(() => net.createServer().listen(Number(port), '127.0.0.1'), Number(delay))
`

interface Recorder {
  text: string
  write: (text: string) => void
}

let dir: string
let current: object | null = null

const REGISTRATION_KEYS = new Set(['name', 'instances'])

const recorder = (): Recorder => {
  const out: Recorder = { text: '', write: (text) => void (out.text += text) }
  return out
}

/** Ports nothing listens on, from the OS rather than a guess, so no Demo port is ever taken. */
const freePorts = async (count: number): Promise<number[]> => {
  const servers = Array.from({ length: count }, () => net.createServer())
  await Promise.all(
    servers.map(async (server) => {
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve)
      })
    })
  )
  const ports = servers.map((server) => (server.address() as AddressInfo).port)
  await Promise.all(
    servers.map(async (server) => await new Promise((resolve) => server.close(resolve)))
  )
  return ports
}

/** `config` as one app: pinned in its registration, else committed as the checkout's recipe. */
const appOf = (config: object, committed: boolean): RigConfig => {
  const registration = parseRegistration(JSON.stringify(config), path.join(dir, 'app.yaml'))
  if (!committed) return resolveApp(registration, null)
  const recipe = Object.entries(config).filter(([key]) => !REGISTRATION_KEYS.has(key))
  const text = JSON.stringify(Object.fromEntries(recipe))
  return resolveApp(registration, { text, file: path.join(dir, 'muster.yaml') })
}

const rigOf = (config: object, out: Recorder, committed = false): Rig => {
  current = config
  return new Rig(appOf(config, committed), {
    repo: dir,
    reason: 'integration test',
    wait: false,
    force: false,
    out,
    pollMs: 100,
    tickMs: 100
  })
}

const base = (processes: object[]): object => ({
  name: 'Fixture',
  instances: { mode: 'one-per-checkout', lock: path.join(dir, 'locks', 'lock.json') },
  processes,
  ready: [{ ports: 'all', timeout: '10s' }],
  logs: path.join(dir, 'logs', '{key}.log')
})

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muster-rig-'))
  fs.writeFileSync(path.join(dir, 'server.js'), SERVER)
  fs.writeFileSync(path.join(dir, 'fix.js'), "require('node:fs').writeFileSync('installed', '')")
})

afterEach(async () => {
  if (current !== null) await rigOf(current, recorder()).down(true)
  current = null
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('Rig', () => {
  it('brings a rig up in order, repairs once, and takes it down again', async () => {
    const [slow, first, second, fussy] = await freePorts(4)
    const config = base([
      {
        key: 'slow',
        label: 'Slow build',
        ports: [slow],
        cmd: `node server.js ${slow} 1500`,
        slow: { startFirst: true, timeout: '30s' }
      },
      {
        key: 'second',
        label: 'Second',
        ports: [second],
        cmd: `node server.js ${second} 0`,
        after: ['first', 'slow']
      },
      { key: 'first', label: 'First', ports: [first], cmd: `node server.js ${first} 300` },
      {
        key: 'fussy',
        label: 'Fussy',
        ports: [fussy],
        cmd: `node server.js ${fussy} 0 installed`,
        onFailure: [{ match: 'MODULE_MISSING', run: 'node fix.js' }]
      }
    ])
    const out = recorder()
    const rig = rigOf(config, out)

    await expect(rig.up()).resolves.toEqual({ ok: true, busy: false })

    const lines = out.text.split('\n')
    const at = (text: string): number => lines.findIndex((line) => line.includes(text))
    expect(at('Slow build ... starting (background)')).toBeGreaterThan(-1)
    expect(at('First ... starting ... up')).toBeLessThan(at('Slow build ... waiting ... up'))
    expect(at('Slow build ... waiting ... up')).toBeLessThan(at('Second ... starting ... up'))
    expect(out.text).toContain('Fussy ... starting ... missing install, running: node fix.js')
    expect(out.text).toContain('  Fussy ... starting ... up')
    expect(out.text).toContain(`  ready: ports ${slow}, ${second}, ${first}, ${fussy} ... ok`)
    expect(out.text).toContain('rig up 4/4')
    expect(fs.readFileSync(path.join(dir, 'logs', 'first.log'), 'utf8')).toContain(
      `starting on ${first}`
    )

    const again = recorder()
    await expect(rigOf(config, again).up()).resolves.toMatchObject({ ok: true })
    expect(again.text).toContain('everything already up')

    const stopped = recorder()
    await expect(rigOf(config, stopped).down()).resolves.toEqual({ ok: true, busy: false })
    expect(stopped.text).toContain('all ports released')
    for (const port of [slow, first, second, fussy]) await expect(probe(port)).resolves.toBe(false)

    const status = recorder()
    await expect(rigOf(config, status).status()).resolves.toMatchObject({ ok: false })
    expect(status.text).toContain('  holder: free')
    expect(status.text).toContain('4 of 4 missing')
  }, 60_000)

  it('reports an unknown failure and skips what waits on it', async () => {
    const [broken, after] = await freePorts(2)
    const out = recorder()
    const rig = rigOf(
      base([
        {
          key: 'broken',
          label: 'Broken',
          ports: [broken],
          cmd: `node server.js ${broken} 0 crash`,
          onFailure: [{ match: 'MODULE_MISSING', run: 'node fix.js' }]
        },
        {
          key: 'after',
          label: 'After',
          ports: [after],
          cmd: `node server.js ${after} 0`,
          after: ['broken']
        }
      ]),
      out
    )

    await expect(rig.up()).resolves.toEqual({ ok: false, busy: false })
    expect(out.text).toContain('Broken ... starting ... EXITED. log:')
    expect(out.text).toContain('Segmentation fault')
    expect(out.text).toContain('After ... skipped, broken did not come up')
    expect(out.text).not.toContain('running: node fix.js')
    expect(out.text).toContain('2 of 2 missing')
  }, 60_000)

  it('releases only the slot this checkout holds', async () => {
    const [port] = await freePorts(1)
    const config = base([{ key: 'one', ports: [port], cmd: `node server.js ${port} 0` }])
    await rigOf(config, recorder()).up()

    const out = recorder()
    await expect(rigOf(config, out).release()).resolves.toEqual({ ok: true, busy: false })
    expect(out.text).toContain('rig released')
    await expect(probe(port)).resolves.toBe(false)

    const nothing = recorder()
    await expect(rigOf(config, nothing).release()).resolves.toMatchObject({ ok: true })
    expect(nothing.text).toContain('nothing to release')
  }, 60_000)

  it('warns when the recipe changed since launch, and still stops what it launched', async () => {
    const [launched = 0, renamed = 0] = await freePorts(2)
    const before = base([{ key: 'one', ports: [launched], cmd: `node server.js ${launched} 0` }])
    await rigOf(before, recorder()).up()
    const after = base([{ key: 'one', ports: [renamed], cmd: `node server.js ${renamed} 0` }])

    const status = recorder()
    await rigOf(after, status).status()
    expect(status.text).toContain('changed since this instance launched')
    await expect(rigOf(after, recorder()).snapshot()).resolves.toMatchObject({
      holders: [expect.objectContaining({ recipeChanged: true })]
    })

    await rigOf(after, recorder()).down()
    await expect(probe(launched)).resolves.toBe(false)
  }, 60_000)

  it('warns when a recipe is committed over the pinned one an instance launched with', async () => {
    const [port = 0] = await freePorts(1)
    const config = base([{ key: 'one', ports: [port], cmd: `node server.js ${port} 0` }])
    await rigOf(config, recorder()).up()

    const committed = { ...config, ready: [{ ports: 'all', timeout: '20s' }] }
    const status = recorder()
    await rigOf(committed, status, true).status()
    expect(status.text).toContain('changed since this instance launched')
  }, 60_000)

  it('runs a changed recipe on a new up without a release, and stops both', async () => {
    const [launched = 0, added = 0] = await freePorts(2)
    const before = base([{ key: 'one', ports: [launched], cmd: `node server.js ${launched} 0` }])
    await rigOf(before, recorder()).up()
    const after = base([
      { key: 'one', ports: [launched], cmd: `node server.js ${launched} 0` },
      { key: 'two', ports: [added], cmd: `node server.js ${added} 0` }
    ])
    await expect(rigOf(after, recorder()).up()).resolves.toMatchObject({ ok: true })

    const status = recorder()
    await rigOf(after, status).status()
    expect(status.text).not.toContain('changed since this instance launched')

    await rigOf(before, recorder()).down()
    for (const port of [launched, added]) await expect(probe(port)).resolves.toBe(false)
  }, 60_000)
})
