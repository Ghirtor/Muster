import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { probe } from '../probe'
import type { InstancesConfig } from './config.types'
import type {
  AcquireOptions,
  AcquireResult,
  HeldSlot,
  Lock,
  LockContext,
  QueueEntry
} from './lock.types'
import { alive, branchOf } from './shell'

const WIN = process.platform === 'win32'

/** Whether any of `ports` accepts a connection. */
export const anyUp = async (ports: number[]): Promise<boolean> =>
  (await Promise.all(ports.map(async (port) => await probe(port)))).some(Boolean)

/** Windows paths compare case-insensitively; a worktree path may be typed either way. */
export const samePath = (a: string, b: string): boolean => {
  const left = path.resolve(a)
  const right = path.resolve(b)
  return WIN ? left.toLowerCase() === right.toLowerCase() : left === right
}

/** Whether `lock` was taken for the checkout at `repo`. */
export const isMine = (lock: Lock, repo: string): boolean => samePath(lock.repo, repo)

/** A short, stable name for a checkout, the same however its path is cased on Windows. */
const checkoutId = (repo: string): string => {
  const resolved = path.resolve(repo)
  return createHash('sha1')
    .update(WIN ? resolved.toLowerCase() : resolved)
    .digest('hex')
    .slice(0, 10)
}

/**
 * The lock files instances take turns on: the configured file for one per machine, one file per
 * checkout for one per checkout, and `max` numbered files for up to N.
 */
export const slotFiles = (instances: InstancesConfig, repo: string): string[] => {
  const { dir, name, ext } = path.parse(instances.lock)
  if (instances.mode === 'one-per-machine') return [instances.lock]
  if (instances.mode === 'one-per-checkout') {
    return [path.join(dir, `${name}-${checkoutId(repo)}${ext}`)]
  }
  return Array.from({ length: instances.max }, (_, i) => path.join(dir, `${name}-${i + 1}${ext}`))
}

/** The queue checkouts wait in, in the order they asked. */
const queueFile = (instances: InstancesConfig, repo: string): string => {
  const { dir, name } = path.parse(slotFiles(instances, repo)[0] ?? instances.lock)
  return path.join(dir, `${name}.queue.json`)
}

/** The JSON in `file`, or null when it is missing or unreadable. */
const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  } catch {
    return null
  }
}

/** The lock in `file`, or null when the slot is free. */
export const readLock = (file: string): Lock | null => {
  const value = readJson(file) as Partial<Lock> | null
  if (value === null || typeof value.repo !== 'string') return null
  return {
    repo: value.repo,
    branch: value.branch ?? '?',
    reason: value.reason ?? '',
    since: value.since ?? new Date(0).toISOString(),
    ...(value.touched === undefined ? {} : { touched: value.touched }),
    ...(value.pids === undefined ? {} : { pids: value.pids })
  }
}

/** Writes `lock`. Exclusive fails with EEXIST when the slot was taken meanwhile. */
const writeLock = (file: string, lock: Lock, exclusive: boolean): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(lock, null, 2), { flag: exclusive ? 'wx' : 'w' })
}

/** Frees a slot. */
export const dropLock = (file: string): void => {
  fs.rmSync(file, { force: true })
}

/** Who holds a lock, for whoever finds it busy. */
export const describeLock = (lock: Lock): string => {
  const minutes = Math.round((Date.now() - Date.parse(lock.since)) / 60000)
  const reason = lock.reason === '' ? '' : ` for "${lock.reason}"`
  return `${lock.repo} (${lock.branch})${reason}, held ${minutes} min`
}

/** Every slot that is held, with its lock. */
export const holders = (ctx: LockContext): HeldSlot[] =>
  slotFiles(ctx.instances, ctx.repo).flatMap((file) => {
    const lock = readLock(file)
    return lock === null ? [] : [{ file, lock }]
  })

/** The slot this checkout holds, if any. */
export const mySlot = (ctx: LockContext): HeldSlot | null =>
  holders(ctx).find((slot) => isMine(slot.lock, ctx.repo)) ?? null

/**
 * A session can vanish holding a lock. The lock records the `up` that took it and every process it
 * launched: while one of them lives the app is starting — a build listens on nothing for minutes —
 * and once all are gone, nobody is using it. One per machine also needs every port down, since
 * those ports are the instance; `staleAfter` is the backstop for PIDs that cannot be trusted.
 */
export const isStale = async (ctx: LockContext, lock: Lock): Promise<boolean> => {
  if (ctx.instances.mode === 'one-per-machine' && (await anyUp(ctx.ports))) return false
  const last = Date.parse(lock.touched ?? lock.since)
  const old = Date.now() - last > ctx.instances.staleAfterMs
  return lock.pids === undefined ? old : old || !lock.pids.some(alive)
}

/** Adds a process to this checkout's lock, dropping the ones that have exited. */
export const recordPid = (ctx: LockContext, pid: number): void => {
  const slot = mySlot(ctx)
  if (slot === null) return
  const pids = [...(slot.lock.pids ?? []).filter(alive), pid]
  writeLock(slot.file, { ...slot.lock, pids, touched: new Date().toISOString() }, false)
}

/** The queue, without the waiters whose process has gone. */
const readQueue = (ctx: LockContext): QueueEntry[] => {
  const value = readJson(queueFile(ctx.instances, ctx.repo))
  return Array.isArray(value) ? (value as QueueEntry[]).filter((entry) => alive(entry.pid)) : []
}

/** Replaces the queue. */
const writeQueue = (ctx: LockContext, queue: QueueEntry[]): void => {
  const file = queueFile(ctx.instances, ctx.repo)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(queue, null, 2))
}

/** Takes this process out of the queue. */
const leaveQueue = (ctx: LockContext): void => {
  const queue = readQueue(ctx)
  const rest = queue.filter((entry) => entry.pid !== process.pid)
  if (rest.length !== queue.length || fs.existsSync(queueFile(ctx.instances, ctx.repo))) {
    writeQueue(ctx, rest)
  }
}

/** Whether this process may take a free slot: nobody is queued, or it is first. */
const firstInLine = (ctx: LockContext): boolean => {
  const head = readQueue(ctx).at(0)
  return head === undefined || head.pid === process.pid
}

/** The checkouts waiting, first in line first. */
export const waiting = (ctx: LockContext): QueueEntry[] => readQueue(ctx)

/** Prints why the slot cannot be taken now. */
const reportBusy = (ctx: LockContext, held: HeldSlot[]): void => {
  for (const slot of held) ctx.out.write(`  BUSY: the rig is held by ${describeLock(slot.lock)}\n`)
  const queued = readQueue(ctx).length
  if (queued > 0) ctx.out.write(`  ${queued} waiting ahead in the queue\n`)
}

/**
 * Takes a slot for `ctx.repo`. The exclusive create is the atomic step: two checkouts racing for a
 * free slot cannot both win it. Waiting joins a queue, so slots go to waiters in the order they
 * asked. `onStale` runs after a stale lock is dropped, while the slot is still free.
 */
export const acquire = async (
  ctx: LockContext,
  options: AcquireOptions
): Promise<AcquireResult> => {
  const machine = ctx.instances.mode === 'one-per-machine'
  let queued = false
  for (;;) {
    const now = new Date().toISOString()
    const held = holders(ctx)
    const own = held.find((slot) => isMine(slot.lock, ctx.repo))
    if (own !== undefined) {
      const reason = options.reason === '' ? own.lock.reason : options.reason
      writeLock(own.file, { ...own.lock, reason, touched: now }, false)
      recordPid(ctx, process.pid)
      leaveQueue(ctx)
      return { held: true, file: own.file }
    }
    const stale: HeldSlot[] = []
    for (const slot of held) if (await isStale(ctx, slot.lock)) stale.push(slot)
    if (stale.length > 0) {
      for (const slot of stale) {
        ctx.out.write(`  stale lock from ${describeLock(slot.lock)} — taking it over\n`)
        dropLock(slot.file)
      }
      if (machine) await options.onStale()
      continue
    }
    if (machine && held.length === 0 && (await anyUp(ctx.ports))) {
      ctx.out.write(
        '  BUSY: its ports are in use but no checkout holds the rig — it was started by hand or\n' +
          '  outside Muster. Which code it runs is unknown, so ask before stopping it with `down`,\n' +
          '  then run `up` again.\n'
      )
      leaveQueue(ctx)
      return { held: false, foreign: true }
    }
    const free = slotFiles(ctx.instances, ctx.repo).find((file) => readLock(file) === null)
    if (free !== undefined && firstInLine(ctx)) {
      const branch = branchOf(ctx.repo)
      try {
        const lock = { repo: ctx.repo, branch, reason: options.reason, since: now, touched: now }
        writeLock(free, { ...lock, pids: [process.pid] }, true)
        ctx.out.write(`  rig taken for ${ctx.repo} (${branch})\n`)
        leaveQueue(ctx)
        return { held: true, file: free }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
        throw error
      }
    }
    if (!options.wait) {
      reportBusy(ctx, held)
      ctx.out.write('  rerun with --wait to queue for it\n')
      return { held: false, foreign: false }
    }
    if (!queued) {
      const entry = {
        repo: ctx.repo,
        branch: branchOf(ctx.repo),
        reason: options.reason,
        since: now,
        pid: process.pid
      }
      writeQueue(ctx, [...readQueue(ctx).filter((e) => e.pid !== process.pid), entry])
      queued = true
      const holder = held.at(0)
      const position = readQueue(ctx).length
      const who = holder === undefined ? 'others in the queue' : describeLock(holder.lock)
      ctx.out.write(`  waiting: the rig is held by ${who} (position ${position} in the queue)\n`)
    }
    await new Promise((resolve) => setTimeout(resolve, ctx.pollMs))
  }
}
