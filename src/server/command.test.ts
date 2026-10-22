import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { EXIT, exitCode, parseFlags, runCommand, USAGE } from './command'
import type { CommandIo } from './command.types'

interface Recorded {
  io: CommandIo
  out: () => string
  err: () => string
}

let dir: string

const record = (env: NodeJS.ProcessEnv = {}): Recorded => {
  let out = ''
  let err = ''
  return {
    io: {
      out: { write: (text) => void (out += text) },
      err: { write: (text) => void (err += text) },
      env,
      cwd: dir
    },
    out: () => out,
    err: () => err
  }
}

/** A one-per-machine config whose only process listens on a port nothing uses. */
const writeConfig = (file = 'muster.yaml'): string => {
  const config = {
    name: 'Fixture',
    instances: { mode: 'one-per-machine', lock: path.join(dir, 'lock.json') },
    processes: [{ key: 'web', label: 'Web', ports: [1], cmd: 'node -e ""' }],
    logs: path.join(dir, '{key}.log')
  }
  fs.writeFileSync(path.join(dir, file), JSON.stringify(config))
  return path.join(dir, file)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muster-cli-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('parseFlags', () => {
  it('reads valued and bare flags as rig.mjs does', () => {
    expect(
      parseFlags(['up', '--repo', 'C:/x', '--wait', '--reason', 'checking', '--force'])
    ).toEqual({
      repo: 'C:/x',
      wait: true,
      reason: 'checking',
      force: true
    })
  })
})

describe('exitCode', () => {
  it('maps outcomes to rig.mjs exit codes', () => {
    expect(exitCode({ ok: true, busy: false })).toBe(0)
    expect(exitCode({ ok: false, busy: false })).toBe(1)
    expect(exitCode({ ok: false, busy: true })).toBe(3)
  })
})

describe('runCommand', () => {
  it('prints the usage for an unknown command', async () => {
    const run = record()

    await expect(runCommand(['restart'], run.io)).resolves.toBe(EXIT.usage)
    expect(run.err()).toBe(`${USAGE}\n`)
  })

  it('reports an invalid config as a usage error', async () => {
    fs.writeFileSync(path.join(dir, 'muster.yaml'), 'name: Broken\n')
    const run = record()

    await expect(runCommand(['status'], run.io)).resolves.toBe(EXIT.usage)
    expect(run.err()).toMatch(/is not a valid Muster config/)
  })

  it('runs status by default from muster.yaml in the working directory', async () => {
    writeConfig()
    const run = record()

    await expect(runCommand([], run.io)).resolves.toBe(EXIT.failed)
    expect(run.out()).toBe('  holder: free\n\n  1     Web  DOWN\n\n1 of 1 missing\n')
  })

  it('takes the config from MUSTER_CONFIG, and --config over it', async () => {
    const other = writeConfig('other.yaml')
    const fromEnv = record({ MUSTER_CONFIG: other })
    const fromFlag = record({ MUSTER_CONFIG: path.join(dir, 'missing.yaml') })

    await expect(runCommand(['status'], fromEnv.io)).resolves.toBe(EXIT.failed)
    await expect(runCommand(['status', '--config', other], fromFlag.io)).resolves.toBe(EXIT.failed)
    expect(fromFlag.out()).toContain('1 of 1 missing')
  })

  it('exits 3 when another checkout holds the rig', async () => {
    writeConfig()
    const lock = {
      repo: path.join(dir, 'theirs'),
      branch: 'main',
      reason: 'busy',
      since: new Date().toISOString(),
      pids: [process.pid]
    }
    fs.writeFileSync(path.join(dir, 'lock.json'), JSON.stringify(lock))

    const up = record()
    await expect(runCommand(['up', '--repo', path.join(dir, 'mine')], up.io)).resolves.toBe(
      EXIT.busy
    )
    expect(up.out()).toContain('BUSY: the rig is held by')

    const release = record()
    await expect(
      runCommand(['release', '--repo', path.join(dir, 'mine')], release.io)
    ).resolves.toBe(EXIT.busy)
    expect(release.out()).toContain('NOT RELEASED')

    const down = record()
    await expect(runCommand(['down', '--repo', path.join(dir, 'mine')], down.io)).resolves.toBe(
      EXIT.busy
    )
    expect(down.out()).toContain('NOT STOPPED')
    expect(fs.existsSync(path.join(dir, 'lock.json'))).toBe(true)
  })
})
