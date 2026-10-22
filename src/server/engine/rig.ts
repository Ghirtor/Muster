import path from 'node:path'

import { probe } from '../probe'
import type { ProcessConfig, Repair, RigConfig } from './config.types'
import { allUp, launch, waitFor } from './launch'
import type { Launched } from './launch.types'
import {
  acquire,
  describeLock,
  dropLock,
  holders,
  isMine,
  mySlot,
  readLock,
  recordPid,
  slotFiles,
  waiting
} from './lock'
import type { HeldSlot, LockContext } from './lock.types'
import { launchOrder } from './order'
import { waitReady } from './ready'
import { fill, findRepair, repairCommand } from './repair'
import type { Outcome, PortRow, RigOptions, RigSnapshot } from './rig.types'
import { imagePids, killTree, pidsOn, sh } from './shell'

const DONE: Outcome = { ok: true, busy: false }
const FAILED: Outcome = { ok: false, busy: false }
const BUSY: Outcome = { ok: false, busy: true }

/** The last `count` non-empty lines of `text`. */
const tail = (text: string, count: number): string =>
  text.split(/\r?\n/).filter(Boolean).slice(-count).join('\n')

/**
 * One app's rig, run from one checkout: `rig.mjs` with its processes, repairs and instance rules
 * read from a config. Install steps are never run up front: a process is launched first, and only
 * if it exits is its output matched against the known failure signatures, that one repair run and
 * the launch retried once. A process alive but not listening yet is still starting, and is waited on.
 */
export class Rig {
  private readonly ctx: LockContext

  constructor(
    readonly config: RigConfig,
    private readonly options: RigOptions
  ) {
    this.ctx = {
      instances: config.instances,
      repo: path.resolve(options.repo),
      ports: config.processes.flatMap((p) => p.ports),
      out: options.out,
      pollMs: options.pollMs ?? 10_000
    }
  }

  /** Whether instances share the machine's ports, so ports alone say whether one runs. */
  private get machine(): boolean {
    return this.config.instances.mode === 'one-per-machine'
  }

  /** Prints `text` and a line break. */
  private line(text = ''): void {
    this.options.out.write(`${text}\n`)
  }

  /** Prints `text` as it is. */
  private write(text: string): void {
    this.options.out.write(text)
  }

  /** Where `key`'s output goes. */
  logOf(key: string): string {
    return fill(this.config.logs, { key })
  }

  /** Every port of every process, probed. */
  async ports(): Promise<PortRow[]> {
    const rows = this.config.processes.flatMap((p) =>
      p.ports.map((port) => ({ port, key: p.key, label: p.label }))
    )
    return await Promise.all(rows.map(async (row) => ({ ...row, up: await probe(row.port) })))
  }

  /** The slot `release` and `down` act on: the one lock for one per machine, else this checkout's. */
  private slot(): HeldSlot | null {
    if (!this.machine) return mySlot(this.ctx)
    const file = slotFiles(this.config.instances, this.ctx.repo)[0] ?? ''
    const lock = readLock(file)
    return lock === null ? null : { file, lock }
  }

  /**
   * Who holds the rig, who waits for it and which ports listen, read without touching the lock.
   * Foreign means one per machine's ports listen while nobody holds it: started outside Flotilla.
   */
  async snapshot(): Promise<RigSnapshot> {
    const held = holders(this.ctx).map((slot) => slot.lock)
    const ports = await this.ports()
    const listening = ports.filter((row) => row.up).length
    const state = listening === ports.length ? 'up' : listening === 0 ? 'down' : 'partial'
    return {
      state,
      holders: held,
      queue: waiting(this.ctx),
      foreign: this.machine && held.length === 0 && listening > 0,
      ports,
      listening,
      total: ports.length
    }
  }

  /** Prints who holds the rig and which ports listen. Ok when every port listens. */
  async status(): Promise<Outcome> {
    const snapshot = await this.snapshot()
    if (snapshot.holders.length === 0) {
      this.line(
        snapshot.foreign ? '  holder: none recorded (started outside Flotilla)' : '  holder: free'
      )
    }
    for (const lock of snapshot.holders) {
      const mine = isMine(lock, this.ctx.repo) ? '  ← this checkout' : ''
      this.line(`  holder: ${describeLock(lock)}${mine}`)
    }
    if (this.config.instances.mode === 'up-to-n') {
      this.line(`  instances: ${snapshot.holders.length} of ${this.config.instances.max} taken`)
    }
    const first = snapshot.queue.at(0)
    if (first !== undefined) {
      this.line(`  queue: ${snapshot.queue.length} waiting, first ${first.repo} (${first.branch})`)
    }
    this.line()
    const rows = snapshot.ports
    const width = Math.max(...rows.map((row) => row.label.length))
    for (const row of rows) {
      this.line(
        `  ${String(row.port).padEnd(5)} ${row.label.padEnd(width)}  ${row.up ? 'up' : 'DOWN'}`
      )
    }
    const missing = snapshot.total - snapshot.listening
    this.line(
      missing === 0
        ? `\nrig up ${rows.length}/${rows.length}`
        : `\n${missing} of ${rows.length} missing`
    )
    return missing === 0 ? DONE : FAILED
  }

  /** Launches `proc` and records its shell in the lock, so the lock is not stale while it starts. */
  private start(proc: ProcessConfig): Launched {
    const handle = launch(proc, this.ctx.repo, this.logOf(proc.key))
    if (handle.child.pid !== undefined) recordPid(this.ctx, handle.child.pid)
    return handle
  }

  /** Runs a repair in its directory. False, with the failure printed, when it fails. */
  private async repair(repair: Repair, proc: ProcessConfig): Promise<boolean> {
    if (repair.cleanup) {
      this.line(' ... stale processes, cleaning up')
      await this.down(true)
      return true
    }
    const dir = path.resolve(this.ctx.repo, repair.cwd ?? proc.cwd)
    const command = repairCommand(repair, dir)
    this.line(` ... missing install, running: ${command}`)
    if (command === '') return true
    const result = sh(command, dir)
    if (!result.ok) this.line(`     install FAILED:\n${result.out.slice(-800)}`)
    return result.ok
  }

  /** Waits on a launched process; on an exit with a known signature, repairs once and retries. */
  private async settle(proc: ProcessConfig, handle: Launched, retrying: boolean): Promise<boolean> {
    const result = await waitFor(proc, handle, proc.timeoutMs, this.options.tickMs)
    handle.child.unref()
    if (result.ok) {
      this.line(' ... up')
      return true
    }
    if (!result.exited) {
      this.line(` ... TIMEOUT (still alive, never listened). log: ${handle.log}`)
      return false
    }
    const repair = findRepair(proc.onFailure, result.out)
    if (repair !== null && !retrying) {
      if (!(await this.repair(repair, proc))) return false
      return await this.bring(proc, true)
    }
    this.line(` ... EXITED. log: ${handle.log}`)
    this.line(tail(result.out, 12))
    return false
  }

  /** Brings one process up unless it already listens. */
  private async bring(proc: ProcessConfig, retrying = false): Promise<boolean> {
    if (await allUp(proc.ports)) {
      this.line(`  ${proc.label} ... already up`)
      return true
    }
    this.write(`  ${proc.label} ... starting`)
    return await this.settle(proc, this.start(proc), retrying)
  }

  /**
   * Builds the missing processes of every sequential build group one at a time, before any of them
   * runs. Projects that share references race for the same outputs when built concurrently (.NET's
   * CS2012), which is a concurrency bug rather than a missing install, so this happens regardless
   * of any failure signature. A failed build gets its process's repair once.
   */
  private build(missing: ProcessConfig[]): boolean {
    for (const proc of missing) {
      const group = proc.build === undefined ? undefined : this.config.buildGroups[proc.build.group]
      if (proc.build === undefined || group === undefined || !group.sequential) continue
      const command = fill(group.cmd, { project: proc.build.project })
      this.write(`  building ${proc.build.project} ... `)
      const result = sh(command, this.ctx.repo)
      if (result.ok) {
        this.line('ok')
        continue
      }
      const repair = findRepair(proc.onFailure, result.out)
      if (repair !== null && !repair.cleanup) {
        const dir = path.resolve(this.ctx.repo, repair.cwd ?? proc.cwd)
        this.line('repairing')
        sh(repairCommand(repair, dir), dir)
        if (sh(command, this.ctx.repo).ok) {
          this.line(`  building ${proc.build.project} ... ok (after repair)`)
          continue
        }
      }
      this.line('FAILED')
      const errors = result.out.split(/\r?\n/).filter((line) => /error/i.test(line))
      this.line((errors.length > 0 ? errors.slice(0, 5) : [tail(result.out, 5)]).join('\n'))
      return false
    }
    return true
  }

  /** Probes each tool by running it, and installs it only when that fails. */
  private tools(): void {
    for (const tool of this.config.tools) {
      if (sh(tool.probe, this.ctx.repo).ok) continue
      const failure = sh(tool.probe, this.ctx.repo).out
      const repair = findRepair(tool.onFailure, failure) ?? tool.onFailure.at(-1)
      if (repair === undefined) {
        this.line(`  ${tool.key} ... unavailable`)
        continue
      }
      const dir = path.resolve(this.ctx.repo, repair.cwd ?? '.')
      const command = repairCommand(repair, dir)
      this.line(`  ${tool.key} ... unavailable, running: ${command}`)
      const install = sh(command, dir)
      if (!install.ok) this.line(`     install FAILED:\n${install.out.slice(-600)}`)
      else if (!sh(tool.probe, this.ctx.repo).ok) this.line(`     ${tool.key} still unavailable`)
      else this.line(`  ${tool.key} ... installed`)
    }
  }

  /**
   * Takes the rig for this checkout and launches what is missing, in launch order. A slow process
   * started first overlaps its build with everything else and is waited on last, or as soon as a
   * process names it in `after`. A process whose `after` did not come up is skipped.
   */
  async up(): Promise<Outcome> {
    this.line(`flotilla up — ${this.config.name}\n`)
    const taken = await acquire(this.ctx, {
      reason: this.options.reason,
      wait: this.options.wait || this.config.instances.whenBusy === 'wait',
      onStale: async () => await this.down(true)
    })
    if (!taken.held) return BUSY

    const missing: ProcessConfig[] = []
    for (const proc of launchOrder(this.config.processes).order) {
      if (!(await allUp(proc.ports))) missing.push(proc)
    }
    if (missing.length === 0) {
      this.line('  everything already up\n')
      const ready = await this.ready()
      const status = await this.status()
      return { ok: ready && status.ok, busy: false }
    }
    if (!this.build(missing)) return FAILED

    const pending = new Map<string, Launched>()
    for (const proc of missing.filter((p) => p.slow?.startFirst === true)) {
      this.line(`  ${proc.label} ... starting (background)`)
      pending.set(proc.key, this.start(proc))
    }
    const failed = new Set<string>()
    const settlePending = async (proc: ProcessConfig): Promise<void> => {
      const handle = pending.get(proc.key)
      if (handle === undefined) return
      pending.delete(proc.key)
      this.write(`  ${proc.label} ... waiting`)
      if (!(await this.settle(proc, handle, false))) failed.add(proc.key)
    }
    for (const proc of missing) {
      if (pending.has(proc.key)) continue
      for (const dependency of proc.after) {
        const slow = missing.find((p) => p.key === dependency)
        if (slow !== undefined) await settlePending(slow)
      }
      const blocker = proc.after.find((dependency) => failed.has(dependency))
      if (blocker !== undefined) {
        this.line(`  ${proc.label} ... skipped, ${blocker} did not come up`)
        failed.add(proc.key)
      } else if (!(await this.bring(proc))) {
        failed.add(proc.key)
      }
    }
    for (const proc of missing) await settlePending(proc)

    this.tools()
    const ready = failed.size === 0 ? await this.ready() : false
    this.line()
    const status = await this.status()
    return { ok: failed.size === 0 && ready && status.ok, busy: false }
  }

  /** Waits on every readiness check in turn. */
  private async ready(): Promise<boolean> {
    let ok = true
    for (const check of this.config.ready) {
      ok = (await waitReady(check, this.options.out, this.options.tickMs)) && ok
    }
    return ok
  }

  /** Stops the rig and frees its slot — only this checkout's, unless `force`. */
  async release(): Promise<Outcome> {
    this.line(`flotilla release — ${this.config.name}\n`)
    const slot = this.slot()
    if (slot === null) {
      this.line('  this checkout does not hold the rig — nothing to release')
      return DONE
    }
    if (!isMine(slot.lock, this.ctx.repo) && !this.options.force) {
      this.line(`  NOT RELEASED: the rig is held by ${describeLock(slot.lock)}`)
      return BUSY
    }
    const stopped = await this.down()
    dropLock(slot.file)
    this.line('  rig released')
    return stopped.ok ? DONE : FAILED
  }

  /**
   * Stops every process: each port's owning process tree, then the configured images, whose
   * children outlive the wrapper that started them (WebView2 under `npm`). Then probes again to
   * prove the ports are free. Quiet is the internal form — a stale takeover or a cleanup repair —
   * which already owns the rig, so it neither checks nor drops the lock.
   */
  async down(quiet = false): Promise<Outcome> {
    if (!quiet) this.line(`flotilla down — ${this.config.name}\n`)
    const slot = quiet ? null : this.slot()
    if (slot !== null && !isMine(slot.lock, this.ctx.repo) && !this.options.force) {
      this.line(
        `  NOT STOPPED: the rig is held by ${describeLock(slot.lock)} — use --force to stop it anyway`
      )
      return BUSY
    }
    if (slot !== null) dropLock(slot.file)

    const victims = new Set<number>()
    for (const port of this.ctx.ports) for (const pid of pidsOn(port)) victims.add(pid)
    if (this.machine)
      for (const pid of imagePids(this.config.instances.killImages)) victims.add(pid)
    else for (const pid of slot?.lock.pids ?? []) victims.add(pid)
    victims.delete(process.pid)
    victims.delete(process.ppid)

    if (victims.size === 0 && !quiet) this.line('  nothing running')
    for (const pid of victims) {
      const killed = killTree(pid)
      if (!quiet) this.line(`  pid ${pid} ... ${killed ? 'killed' : 'already gone'}`)
    }

    let still: number[] = []
    for (let attempt = 0; attempt < 10; attempt++) {
      const probes = await Promise.all(this.ctx.ports.map(async (port) => await probe(port)))
      still = this.ctx.ports.filter((_, i) => probes.at(i) === true)
      if (still.length === 0 || victims.size === 0) break
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    if (!quiet) {
      this.line(
        still.length === 0 ? '\nall ports released' : `\nSTILL LISTENING: ${still.join(', ')}`
      )
    }
    return still.length === 0 ? DONE : FAILED
  }
}
