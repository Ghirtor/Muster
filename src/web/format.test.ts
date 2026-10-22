import type { ProcessView } from './api/musterApi.types'
import {
  baseName,
  checkoutOf,
  duration,
  heldFrom,
  knownBranch,
  modeLabel,
  processStatus
} from './format'

describe('format', () => {
  it.each([
    [4_000, '4 s'],
    [42 * 60_000, '42 m'],
    [3 * 3_600_000, '3 h'],
    [(3 * 60 + 5) * 60_000, '3 h 5 m'],
    [52 * 3_600_000, '2 d 4 h'],
    [-5, '0 s']
  ])('writes %p ms as %p', (ms, text) => {
    expect(duration(ms)).toBe(text)
  })

  it('names instance modes', () => {
    expect(modeLabel('one-per-machine')).toBe('One per machine')
    expect(modeLabel('up-to-n', 3)).toBe('Up to 3')
  })

  it('compares checkouts the way Windows does', () => {
    const lock = { repo: 'C:\\Dev\\Demo\\', branch: 'main', reason: '', since: '' }

    expect(heldFrom(lock, 'c:/dev/demo')).toBe(true)
    expect(heldFrom(lock, 'c:/dev/other')).toBe(false)
    expect(baseName('C:\\dev\\Demo\\')).toBe('Demo')
  })

  it('reads a process state from its ports', () => {
    const proc = { key: 'web' } as ProcessView
    const row = (port: number, up: boolean) => ({ port, key: 'web', label: 'Web', up })

    expect(processStatus(proc, [row(1, true), row(2, true)])).toBe('ok')
    expect(processStatus(proc, [row(1, true), row(2, false)])).toBe('warn')
    expect(processStatus(proc, [row(1, false)])).toBe('idle')
  })

  it('names a checkout by folder and branch, leaving out a branch git could not tell', () => {
    expect(knownBranch('?')).toBe('')
    expect(checkoutOf({ repo: 'C:\\dev\\Other', branch: 'main' })).toBe('Other · main')
    expect(checkoutOf({ repo: 'C:\\dev\\Other', branch: '?' })).toBe('Other')
  })
})
