import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

import { killTree } from '../engine/shell'
import type { ActionRequest, Job, JobEvent, JobOutcome, Started } from './jobs.types'
import type { AppEntry } from './registry.types'

const OUTCOMES: Record<number, JobOutcome> = { 0: 'ok', 1: 'failed', 2: 'usage', 3: 'busy' }
const MAX_OUTPUT = 256 * 1024

interface Running {
  job: Job
  output: string
  child: ChildProcess | null
}

/** The CLI flags that carry `request`. */
export const argsOf = (file: string, request: ActionRequest): string[] => [
  request.action,
  '--config',
  file,
  ...(request.repo === undefined ? [] : ['--repo', request.repo]),
  ...(request.reason === undefined ? [] : ['--reason', request.reason]),
  ...(request.wait === true ? ['--wait'] : []),
  ...(request.force === true ? ['--force'] : [])
]

/**
 * Actions run as `flotilla` CLI processes, exactly as an agent runs them. The lock records the PID
 * that took it and the queue orders waiters by PID, so each action needs a process of its own: run
 * inside the long-lived supervisor, every lock would look alive for as long as the supervisor
 * does. One action runs per app at a time; the last `keep` finished jobs stay readable.
 */
export class Jobs {
  private readonly jobs = new Map<string, Running>()
  private readonly listeners = new Set<(event: JobEvent) => void>()
  private next = 1

  constructor(
    private readonly cli: string[],
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly keep = 50
  ) {}

  /** Calls `listener` with every job change and output chunk; returns the unsubscribe. */
  onEvent(listener: (event: JobEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Every job, newest first. */
  list(): Job[] {
    return [...this.jobs.values()].map((run) => run.job).reverse()
  }

  /** A job and everything it printed so far, or null. */
  get(id: string): { job: Job; output: string } | null {
    const run = this.jobs.get(id)
    return run === undefined ? null : { job: run.job, output: run.output }
  }

  /** Starts `request` on `app`, unless an action already runs on it. */
  start(app: AppEntry, request: ActionRequest): Started {
    const running = [...this.jobs.values()].find(
      (run) => run.job.app === app.id && run.job.state === 'running'
    )
    if (running !== undefined) return { ok: false, running: running.job }
    const [command = process.execPath, ...prefix] = this.cli
    const args = argsOf(app.file, request)
    const child = spawn(command, [...prefix, ...args], {
      env: this.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    const job: Job = {
      id: String(this.next++),
      app: app.id,
      action: request.action,
      args,
      state: 'running',
      pid: child.pid ?? null,
      exitCode: null,
      outcome: null,
      startedAt: new Date().toISOString(),
      endedAt: null
    }
    const run: Running = { job, output: '', child }
    this.jobs.set(job.id, run)
    const append = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      run.output = (run.output + text).slice(-MAX_OUTPUT)
      this.emit({ type: 'job-output', id: job.id, text })
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.once('error', (error) => {
      append(Buffer.from(`${error.message}\n`))
      this.finish(run, null)
    })
    child.once('close', (code) => {
      this.finish(run, code)
    })
    this.emit({ type: 'job', job })
    this.prune()
    return { ok: true, job }
  }

  /**
   * Stops a running job with its whole process tree: an `up` cut short takes what it was starting
   * with it, and its lock goes stale once those PIDs are gone. False when it was not running.
   */
  cancel(id: string): boolean {
    const run = this.jobs.get(id)
    if (run?.job.state !== 'running') return false
    run.job = { ...run.job, state: 'cancelled' }
    if (run.job.pid !== null) killTree(run.job.pid)
    else run.child?.kill()
    return true
  }

  /** Cancels every running job, for a supervisor shutting down. */
  stopAll(): void {
    for (const run of this.jobs.values()) this.cancel(run.job.id)
  }

  /** Records how a job ended, once. */
  private finish(run: Running, code: number | null): void {
    if (run.job.endedAt !== null) return
    const cancelled = run.job.state === 'cancelled'
    run.job = {
      ...run.job,
      state: cancelled ? 'cancelled' : 'done',
      exitCode: code,
      outcome: cancelled ? 'cancelled' : (OUTCOMES[code ?? 1] ?? 'failed'),
      endedAt: new Date().toISOString()
    }
    run.child = null
    this.emit({ type: 'job', job: run.job })
  }

  /** Forgets the oldest finished jobs beyond `keep`. */
  private prune(): void {
    const done = [...this.jobs.values()].filter((run) => run.job.state !== 'running')
    for (const run of done.slice(0, Math.max(0, done.length - this.keep))) {
      this.jobs.delete(run.job.id)
    }
  }

  /** Tells every listener. */
  private emit(event: JobEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}
