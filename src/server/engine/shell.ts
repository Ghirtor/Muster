import { execSync } from 'node:child_process'

import type { ShellResult } from './shell.types'

const WIN = process.platform === 'win32'

/**
 * Runs `cmd` in a shell and waits for it. Always execSync, never execFileSync('cmd.exe', ['/c',
 * cmd]): the latter hands cmd.exe a string it re-parses, splitting a quoted argument into pieces,
 * while execSync's `cmd /d /s /c "…"` keeps inner quotes.
 */
export const sh = (cmd: string, cwd: string): ShellResult => {
  try {
    const out = execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true
    })
    return { ok: true, out }
  } catch (error) {
    const failed = error as { stdout?: string | null; stderr?: string | null; message?: string }
    const out = `${failed.stdout ?? ''}${failed.stderr ?? ''}`
    return { ok: false, out: out === '' ? (failed.message ?? '') : out }
  }
}

/** The PIDs listening on `port`, on either address family. */
export const pidsOn = (port: number): number[] => {
  if (WIN) {
    const { out } = sh('netstat -ano | findstr LISTENING', '.')
    const owner = new RegExp(`[:.]${port}$`)
    const pids = out
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter((fields) => fields.length >= 4 && owner.test(fields[1] ?? ''))
      .map((fields) => Number(fields[fields.length - 1]))
    return [...new Set(pids.filter((pid) => pid > 0))]
  }
  const { out } = sh(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`, '.')
  return [...new Set(out.split(/\s+/).filter(Boolean).map(Number))]
}

/** The PIDs of running processes whose image is one of `names`, compared case-insensitively. */
export const imagePids = (names: string[]): number[] => {
  if (names.length === 0) return []
  const wanted = new Set(names.map((name) => name.toLowerCase()))
  if (WIN) {
    const { out } = sh('tasklist /FO CSV /NH', '.')
    return out.split(/\r?\n/).flatMap((line) => {
      const match = /^"([^"]+)","(\d+)"/.exec(line)
      return match?.[1] !== undefined && wanted.has(match[1].toLowerCase())
        ? [Number(match[2])]
        : []
    })
  }
  const { out } = sh('ps -A -o pid= -o comm=', '.')
  return out.split(/\r?\n/).flatMap((line) => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line)
    const image = match?.[2]?.split('/').pop()?.toLowerCase()
    return image !== undefined && wanted.has(image) ? [Number(match?.[1])] : []
  })
}

/** Kills `pid` and every process under it. False when it was already gone. */
export const killTree = (pid: number): boolean => {
  if (WIN) return sh(`taskkill /PID ${pid} /T /F`, '.').ok
  return sh(`kill -9 -${pid} 2>/dev/null || kill -9 ${pid} 2>/dev/null`, '.').ok
}

/** Whether `pid` exists. Signal 0 only checks; EPERM means it exists but is not ours to signal. */
export const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** The branch checked out in `repo`, or `?` when it is not a git checkout. */
export const branchOf = (repo: string): string => {
  const { ok, out } = sh('git rev-parse --abbrev-ref HEAD', repo)
  return ok ? out.trim() || '?' : '?'
}
