import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import type { InstanceMode, InstancesConfig } from './config.types'
import { acquire, holders, isStale, launchVerdict, readLock, recordPid, slotFiles } from './lock'
import type { LaunchVerdict, Lock, LockContext } from './lock.types'

interface Recorder {
  text: string
  write: (text: string) => void
}

let dir: string

const recorder = (): Recorder => {
  const out: Recorder = { text: '', write: (text) => void (out.text += text) }
  return out
}

const instances = (mode: InstanceMode, max = 1): InstancesConfig => ({
  mode,
  max,
  lock: path.join(dir, 'lock.json'),
  staleAfterMs: 20 * 60_000,
  whenBusy: 'fail',
  killImages: []
})

const context = (repo: string, mode: InstanceMode = 'one-per-machine', max = 1): LockContext => ({
  instances: instances(mode, max),
  repo: path.join(dir, repo),
  ports: [],
  out: recorder(),
  pollMs: 50
})

const options = {
  reason: 'testing',
  wait: false,
  onStale: vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined)
}

const hold = (file: string, repo: string, extra: Partial<Lock> = {}): void => {
  const lock: Lock = {
    repo: path.join(dir, repo),
    branch: 'main',
    reason: 'theirs',
    since: new Date().toISOString(),
    pids: [process.pid],
    ...extra
  }
  fs.writeFileSync(file, JSON.stringify(lock))
}

/** The pid of a process that has already exited. */
const deadPid = async (): Promise<number> => {
  const child = spawn(process.execPath, ['-e', ''])
  await new Promise((resolve) => child.once('exit', resolve))
  return child.pid ?? 0
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muster-lock-'))
  options.onStale.mockClear()
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('slotFiles', () => {
  it('gives one per machine the configured file', () => {
    expect(slotFiles(instances('one-per-machine'), 'a')).toEqual([path.join(dir, 'lock.json')])
  })

  it('gives each checkout its own file, the same however it is spelled', () => {
    const [first] = slotFiles(instances('one-per-checkout'), path.join(dir, 'a'))
    const [second] = slotFiles(instances('one-per-checkout'), path.join(dir, 'b'))

    expect(first).toMatch(/lock-[0-9a-f]{10}\.json$/)
    expect(first).not.toBe(second)
    if (process.platform === 'win32') {
      expect(slotFiles(instances('one-per-checkout'), path.join(dir, 'A'))).toEqual([first])
    }
  })

  it('numbers up to N slots', () => {
    expect(slotFiles(instances('up-to-n', 2), 'a').map((file) => path.basename(file))).toEqual([
      'lock-1.json',
      'lock-2.json'
    ])
  })
})

describe('acquire', () => {
  it('takes a free rig and records who holds it', async () => {
    const ctx = context('mine')

    await expect(acquire(ctx, options)).resolves.toEqual({
      held: true,
      file: path.join(dir, 'lock.json')
    })
    expect(readLock(path.join(dir, 'lock.json'))).toMatchObject({
      repo: ctx.repo,
      reason: 'testing'
    })
    expect((ctx.out as Recorder).text).toBe(`  rig taken for ${ctx.repo} (?)
`)
  })

  it('keeps a rig this checkout already holds', async () => {
    hold(path.join(dir, 'lock.json'), 'mine')

    await expect(acquire(context('mine'), options)).resolves.toMatchObject({ held: true })
  })

  it('reports a rig another checkout holds as busy', async () => {
    hold(path.join(dir, 'lock.json'), 'theirs')
    const ctx = context('mine')

    await expect(acquire(ctx, options)).resolves.toEqual({ held: false, foreign: false })
    expect((ctx.out as Recorder).text).toMatch(
      /BUSY: the rig is held by .*theirs \(main\) for "theirs"/
    )
    expect((ctx.out as Recorder).text).toMatch(/rerun with --wait/)
  })

  it('takes over a lock whose processes have all exited', async () => {
    hold(path.join(dir, 'lock.json'), 'theirs', { pids: [await deadPid()] })
    const ctx = context('mine')

    await expect(acquire(ctx, options)).resolves.toMatchObject({ held: true })
    expect((ctx.out as Recorder).text).toMatch(/stale lock from .*theirs/)
    expect(options.onStale).toHaveBeenCalledTimes(1)
  })

  it('takes over a lock older than staleAfter', async () => {
    const old = new Date(Date.now() - 21 * 60_000).toISOString()
    hold(path.join(dir, 'lock.json'), 'theirs', { since: old, pids: undefined })

    await expect(acquire(context('mine'), options)).resolves.toMatchObject({ held: true })
  })

  it('takes the next free slot of up to N', async () => {
    hold(path.join(dir, 'lock-1.json'), 'theirs')
    const ctx = context('mine', 'up-to-n', 2)

    await expect(acquire(ctx, options)).resolves.toEqual({
      held: true,
      file: path.join(dir, 'lock-2.json')
    })
    expect(holders(ctx)).toHaveLength(2)
    await expect(acquire(context('third', 'up-to-n', 2), options)).resolves.toMatchObject({
      held: false
    })
  })

  it('lets checkouts run side by side one per checkout', async () => {
    await expect(acquire(context('a', 'one-per-checkout'), options)).resolves.toMatchObject({
      held: true
    })
    await expect(acquire(context('b', 'one-per-checkout'), options)).resolves.toMatchObject({
      held: true
    })
  })

  it('waits in the queue until the holder lets go', async () => {
    const file = path.join(dir, 'lock.json')
    hold(file, 'theirs')
    const ctx = context('mine')
    setTimeout(() => {
      fs.rmSync(file)
    }, 150)

    await expect(acquire(ctx, { ...options, wait: true })).resolves.toMatchObject({ held: true })
    expect((ctx.out as Recorder).text).toMatch(
      /waiting: the rig is held by .*theirs.*position 1 in the queue/
    )
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'lock.queue.json'), 'utf8'))).toEqual([])
  })
})

/** A checkout queued for the rig in `file`, kept alive by this test's parent process. */
const queue = (file: string, repo: string): void => {
  const entry = {
    repo: path.join(dir, repo),
    branch: 'main',
    reason: 'next',
    since: new Date().toISOString(),
    pid: process.ppid
  }
  fs.writeFileSync(file, JSON.stringify([entry]))
}

/** A server listening on a free port, and how to close it. */
const listening = async (): Promise<{ port: number; close: () => Promise<unknown> }> => {
  const server = net.createServer()
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    port: (server.address() as AddressInfo).port,
    close: async () =>
      await new Promise((resolve) => {
        server.close(resolve)
      })
  }
}

describe('launchVerdict', () => {
  describe('one per machine', () => {
    it('finds a free rig free', async () => {
      await expect(launchVerdict(context('mine'))).resolves.toEqual({
        kind: 'free',
        takesOver: null
      })
    })

    it("finds this checkout's own lock held", async () => {
      hold(path.join(dir, 'lock.json'), 'mine')

      await expect(launchVerdict(context('mine'))).resolves.toMatchObject({
        kind: 'held',
        lock: { repo: path.join(dir, 'mine') }
      })
    })

    it('queues behind another checkout', async () => {
      hold(path.join(dir, 'lock.json'), 'theirs')

      await expect(launchVerdict(context('mine'))).resolves.toMatchObject({
        kind: 'queue',
        behind: { repo: path.join(dir, 'theirs') },
        ahead: 0
      })
    })

    it('queues behind the first waiter rather than the holder', async () => {
      hold(path.join(dir, 'lock.json'), 'theirs')
      queue(path.join(dir, 'lock.queue.json'), 'next')

      await expect(launchVerdict(context('mine'))).resolves.toEqual({
        kind: 'queue',
        behind: expect.objectContaining({ repo: path.join(dir, 'next') }) as Lock,
        ahead: 1
      })
    })

    it('finds a stale lock free, naming the lock it takes over', async () => {
      hold(path.join(dir, 'lock.json'), 'theirs', { pids: [await deadPid()] })

      await expect(launchVerdict(context('mine'))).resolves.toMatchObject({
        kind: 'free',
        takesOver: { repo: path.join(dir, 'theirs') }
      })
    })

    it('finds ports up with nobody holding them foreign', async () => {
      const server = await listening()
      const ctx = { ...context('mine'), ports: [server.port] }

      await expect(launchVerdict(ctx)).resolves.toEqual({ kind: 'foreign' })
      await server.close()
    })
  })

  describe('one per checkout', () => {
    it('finds the rig free while another checkout holds its own', async () => {
      await acquire(context('theirs', 'one-per-checkout'), options)

      await expect(launchVerdict(context('mine', 'one-per-checkout'))).resolves.toEqual({
        kind: 'free',
        takesOver: null
      })
    })
  })

  describe('up to N', () => {
    it('finds a slot free while another checkout holds one of them', async () => {
      hold(path.join(dir, 'lock-1.json'), 'theirs')

      await expect(launchVerdict(context('mine', 'up-to-n', 2))).resolves.toEqual({
        kind: 'free',
        takesOver: null
      })
    })

    it('queues behind the longest holder once every slot is taken', async () => {
      hold(path.join(dir, 'lock-1.json'), 'later')
      hold(path.join(dir, 'lock-2.json'), 'earlier', {
        since: new Date(Date.now() - 60_000).toISOString()
      })

      await expect(launchVerdict(context('mine', 'up-to-n', 2))).resolves.toMatchObject({
        kind: 'queue',
        behind: { repo: path.join(dir, 'earlier') },
        ahead: 0
      })
    })
  })

  describe('agrees with acquire', () => {
    const expected = (verdict: LaunchVerdict): object => {
      if (verdict.kind === 'foreign') return { held: false, foreign: true }
      return verdict.kind === 'queue' ? { held: false, foreign: false } : { held: true }
    }

    it.each([
      ['a free rig', (): void => undefined],
      [
        'its own lock',
        (): void => {
          hold(path.join(dir, 'lock.json'), 'mine')
        }
      ],
      [
        'another holder',
        (): void => {
          hold(path.join(dir, 'lock.json'), 'theirs')
        }
      ],
      [
        'a waiter ahead',
        (): void => {
          queue(path.join(dir, 'lock.queue.json'), 'next')
        }
      ]
    ])('with %s', async (_, arrange) => {
      arrange()
      const verdict = await launchVerdict(context('mine'))

      await expect(acquire(context('mine'), options)).resolves.toMatchObject(expected(verdict))
    })

    it('with a stale lock', async () => {
      hold(path.join(dir, 'lock.json'), 'theirs', { pids: [await deadPid()] })
      const verdict = await launchVerdict(context('mine'))

      expect(verdict.kind).toBe('free')
      await expect(acquire(context('mine'), options)).resolves.toMatchObject(expected(verdict))
    })

    it('with ports up and nobody holding them', async () => {
      const server = await listening()
      const ctx = { ...context('mine'), ports: [server.port] }
      const verdict = await launchVerdict(ctx)

      await expect(acquire(ctx, options)).resolves.toMatchObject(expected(verdict))
      await server.close()
    })
  })
})

describe('isStale', () => {
  const ancient: Lock = { repo: 'x', branch: 'main', reason: '', since: new Date(0).toISOString() }

  it('keeps a one per machine lock while one of its ports listens', async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })
    const ctx = { ...context('mine'), ports: [(server.address() as AddressInfo).port] }

    await expect(isStale(ctx, ancient)).resolves.toBe(false)
    await new Promise((resolve) => {
      server.close(resolve)
    })
    await expect(isStale(ctx, ancient)).resolves.toBe(true)
  })
})

describe('recordPid', () => {
  it("adds a launched process to this checkout's lock", async () => {
    const ctx = context('mine')
    await acquire(ctx, options)
    recordPid(ctx, process.ppid)

    expect(readLock(path.join(dir, 'lock.json'))?.pids).toEqual([process.pid, process.ppid])
  })
})
