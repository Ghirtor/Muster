import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { probe } from '../probe'
import type { ProcessConfig } from './config.types'
import type { Launched, Settled } from './launch.types'

/** Whether every one of `ports` accepts a connection. */
export const allUp = async (ports: number[]): Promise<boolean> =>
  (await Promise.all(ports.map(async (port) => await probe(port)))).every(Boolean)

/** What `file` holds so far, or nothing when the process never opened it. */
export const readLog = (file: string): string => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Starts `proc` in `repo`, its output in `log`. Two things here are deliberate and were arrived at
 * by measurement in rig.mjs: no `detached` — on Windows it gives the child no console and its
 * redirected output goes nowhere — and the shell owns the redirection, because a Node fd in
 * `stdio` does not reach the grandchild through the shell. The shell waits on its command, so it
 * lives exactly as long as the process it runs.
 */
export const launch = (proc: ProcessConfig, repo: string, log: string): Launched => {
  fs.mkdirSync(path.dirname(log), { recursive: true })
  const child = spawn(`${proc.cmd} > "${log}" 2>&1`, {
    cwd: path.resolve(repo, proc.cwd),
    env: { ...process.env, ...proc.env },
    shell: true,
    stdio: 'ignore'
  })
  let exited = child.exitCode !== null
  child.once('exit', () => {
    exited = true
  })
  child.once('error', () => {
    exited = true
  })
  return { child, log, exited: () => exited }
}

/**
 * Waits until every port of `proc` listens. Alive but silent means still starting, so it keeps
 * waiting; an exit is the only thing treated as failure, and `timeoutMs` the only other way out.
 */
export const waitFor = async (
  proc: ProcessConfig,
  handle: Launched,
  timeoutMs: number,
  pollMs = 1000
): Promise<Settled> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await allUp(proc.ports)) return { ok: true, exited: false, out: '' }
    if (handle.exited()) return { ok: false, exited: true, out: readLog(handle.log) }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return { ok: false, exited: false, out: readLog(handle.log) }
}
