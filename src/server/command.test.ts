import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parse } from 'yaml'

import { EXIT, exitCode, parseFlags, runCommand, USAGE } from './command'
import type { CommandIo } from './command.types'

interface Recorded {
  io: CommandIo
  out: () => string
  err: () => string
}

let dir: string
let home: string

const record = (env: NodeJS.ProcessEnv = { MUSTER_HOME: home }): Recorded => {
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

/** A one-per-machine registration of `dir`, its lock and logs in `dir`. */
const writeRegistration = (file = 'app.yaml', extra: object = {}): string => {
  const registration = {
    name: 'Fixture',
    repo: '.',
    instances: { mode: 'one-per-machine', lock: path.join(dir, 'lock.json') },
    ...extra
  }
  fs.writeFileSync(path.join(dir, file), JSON.stringify(registration))
  return path.join(dir, file)
}

/** A recipe in `checkout` whose only process listens on a port nothing uses. */
const writeRecipe = (checkout = dir, recipe: object = {}): void => {
  fs.mkdirSync(checkout, { recursive: true })
  const content = {
    processes: [{ key: 'web', label: 'Web', ports: [1], cmd: 'node -e ""' }],
    logs: path.join(dir, '{key}.log'),
    ...recipe
  }
  fs.writeFileSync(path.join(checkout, 'muster.yaml'), JSON.stringify(content))
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muster-cli-'))
  home = path.join(dir, 'home')
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

  it('refuses a registration with every problem and stores nothing', async () => {
    fs.writeFileSync(path.join(dir, 'broken.yaml'), 'name: Broken\ninstances: { mode: many }\n')
    const run = record()

    await expect(runCommand(['register', 'broken.yaml'], run.io)).resolves.toBe(EXIT.usage)
    expect(run.err()).toMatch(/"mode" must be one of/)
    expect(run.err()).toContain('The muster skill (project-skills) describes the format.')
    expect(fs.existsSync(path.join(home, 'apps'))).toBe(false)
  })

  it('refuses a registration whose checkout has no recipe and that pins none', async () => {
    writeRegistration()
    const run = record()

    await expect(runCommand(['register', 'app.yaml'], run.io)).resolves.toBe(EXIT.usage)
    expect(run.err()).toMatch(/muster\.yaml does not exist and no recipe is pinned/)
  })

  it('refuses instances written in the recipe', async () => {
    writeRegistration()
    writeRecipe(dir, { instances: { mode: 'up-to-n', max: 2 } })
    const run = record()

    await expect(runCommand(['register', 'app.yaml'], run.io)).resolves.toBe(EXIT.usage)
    expect(run.err()).toMatch(/"instances" belongs to the registration/)
  })

  it('registers an app, lists it and runs status from its checkout', async () => {
    writeRegistration()
    writeRecipe()
    const registering = record()

    await expect(runCommand(['register', 'app.yaml'], registering.io)).resolves.toBe(EXIT.ok)
    expect(registering.out()).toContain('registered fixture')
    const stored = fs.readFileSync(path.join(home, 'apps', 'fixture.yaml'), 'utf8')
    expect(parse(stored)).toMatchObject({ name: 'Fixture', repo: dir })

    const listing = record()
    await expect(runCommand(['apps'], listing.io)).resolves.toBe(EXIT.ok)
    expect(listing.out()).toBe(`fixture\tFixture\t${dir}\t${path.join(dir, 'muster.yaml')}\n`)

    const status = record()
    await expect(runCommand(['--app', 'fixture'], status.io)).resolves.toBe(EXIT.failed)
    expect(status.out()).toBe('  holder: free\n\n  1     Web  DOWN\n\n1 of 1 missing\n')

    const fromEnv = record({ MUSTER_HOME: home, MUSTER_APP: 'fixture' })
    await expect(runCommand(['status'], fromEnv.io)).resolves.toBe(EXIT.failed)
  })

  it('reads the recipe of the checkout given by --repo, else the pinned one', async () => {
    writeRegistration('app.yaml', {
      processes: [{ key: 'pinned', label: 'Pinned', ports: [2], cmd: 'node -e ""' }]
    })
    await runCommand(['register', 'app.yaml'], record().io)
    const other = path.join(dir, 'other')
    writeRecipe(other)

    const fromOther = record()
    await runCommand(['status', '--app', 'fixture', '--repo', other], fromOther.io)
    expect(fromOther.out()).toContain('Web  DOWN')

    const pinned = record()
    await runCommand(['status', '--app', 'fixture'], pinned.io)
    expect(pinned.out()).toContain('Pinned  DOWN')
  })

  it('asks for --app and refuses an unregistered one', async () => {
    const missing = record()
    await expect(runCommand(['status'], missing.io)).resolves.toBe(EXIT.usage)
    expect(missing.err()).toMatch(/--app <id> is required/)

    const unknown = record()
    await expect(runCommand(['up', '--app', 'nobody'], unknown.io)).resolves.toBe(EXIT.usage)
    expect(unknown.err()).toMatch(/nobody is not registered: run muster register <file>/)
  })

  it('refuses an id that only reaches a file outside the registrations', async () => {
    writeRegistration()
    writeRecipe()
    const outside = path.relative(path.join(home, 'apps'), path.join(dir, 'app'))

    const status = record()
    await expect(runCommand(['status', '--app', outside], status.io)).resolves.toBe(EXIT.usage)
    expect(status.err()).toMatch(/is not registered/)
  })

  it('refuses a pinned recipe that is invalid, though the checkout has its own', async () => {
    writeRegistration('app.yaml', { processes: [] })
    writeRecipe()

    const refused = record()
    await expect(runCommand(['register', 'app.yaml'], refused.io)).resolves.toBe(EXIT.usage)
    expect(refused.err()).toMatch(/"processes" must list at least one process/)
    expect(fs.existsSync(path.join(home, 'apps'))).toBe(false)
  })

  it('exits 3 when another checkout holds the rig', async () => {
    writeRegistration()
    writeRecipe()
    await runCommand(['register', 'app.yaml'], record().io)
    const mine = path.join(dir, 'mine')
    writeRecipe(mine)
    const lock = {
      repo: path.join(dir, 'theirs'),
      branch: 'main',
      reason: 'busy',
      since: new Date().toISOString(),
      pids: [process.pid]
    }
    fs.writeFileSync(path.join(dir, 'lock.json'), JSON.stringify(lock))
    const app = ['--app', 'fixture', '--repo', mine]

    const up = record()
    await expect(runCommand(['up', ...app], up.io)).resolves.toBe(EXIT.busy)
    expect(up.out()).toContain('BUSY: the rig is held by')

    const release = record()
    await expect(runCommand(['release', ...app], release.io)).resolves.toBe(EXIT.busy)
    expect(release.out()).toContain('NOT RELEASED')

    const down = record()
    await expect(runCommand(['down', ...app], down.io)).resolves.toBe(EXIT.busy)
    expect(down.out()).toContain('NOT STOPPED')
    expect(fs.existsSync(path.join(dir, 'lock.json'))).toBe(true)
  })
})
