import fs from 'node:fs'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { probe } from '../probe'
import { parseConfig } from './config'
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

const rigOf = (config: object, out: Recorder): Rig => {
  current = config
  return new Rig(parseConfig(JSON.stringify(config), path.join(dir, 'muster.yaml')), {
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
})
