import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { Repair } from './config.types'
import { fill, findRepair, repairCommand } from './repair'

const venv: Repair = {
  match: /ModuleNotFoundError|ENOENT/i,
  steps: [
    { run: 'python -m venv .venv', unlessExists: '.venv' },
    { run: 'pip install -e ".{extras}"' }
  ],
  cleanup: false,
  vars: { extras: '[dev]' }
}
const cleanup: Repair = { match: /EPERM/, steps: [], cleanup: true, vars: {} }

describe('fill', () => {
  it('fills known names and leaves the rest', () => {
    expect(fill('{a}-{b}', { a: '1' })).toBe('1-{b}')
  })
})

describe('findRepair', () => {
  it('picks the first repair whose signature is in the output', () => {
    expect(findRepair([cleanup, venv], 'Error: EPERM, then ENOENT')).toBe(cleanup)
    expect(findRepair([cleanup, venv], 'ModuleNotFoundError: x')).toBe(venv)
  })

  it('finds nothing for an unknown failure', () => {
    expect(findRepair([cleanup, venv], 'Segmentation fault')).toBeNull()
  })
})

describe('repairCommand', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muster-repair-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('runs every step when nothing exists yet', () => {
    expect(repairCommand(venv, dir)).toBe('python -m venv .venv && pip install -e ".[dev]"')
  })

  it('skips a step whose path exists', () => {
    fs.mkdirSync(path.join(dir, '.venv'))

    expect(repairCommand(venv, dir)).toBe('pip install -e ".[dev]"')
  })
})
