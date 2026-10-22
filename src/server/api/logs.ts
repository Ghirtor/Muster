import fs from 'node:fs'

/** The size of `file`, or 0 while it does not exist. */
export const sizeOf = (file: string): number =>
  fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0

/** The bytes of `file` from `start` to `end`, as text. Empty when the file is missing. */
export const readRange = (file: string, start: number, end: number): string => {
  if (end <= start) return ''
  let fd: number
  try {
    fd = fs.openSync(file, 'r')
  } catch {
    return ''
  }
  try {
    const buffer = Buffer.alloc(end - start)
    const read = fs.readSync(fd, buffer, 0, buffer.length, start)
    return buffer.subarray(0, read).toString('utf8')
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * The end of `file`: at most its last `maxBytes`, starting at a line so the first line shown is
 * whole, and the size it was read up to, for a follower to continue from.
 */
export const tailLog = (file: string, maxBytes = 64 * 1024): { text: string; size: number } => {
  const size = sizeOf(file)
  const start = Math.max(0, size - maxBytes)
  const text = readRange(file, start, size)
  const firstBreak = text.indexOf('\n')
  return { text: start > 0 && firstBreak >= 0 ? text.slice(firstBreak + 1) : text, size }
}
