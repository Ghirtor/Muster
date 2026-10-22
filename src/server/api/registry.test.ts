import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Registry } from './registry'

let dir: string

const config = (name: string): string =>
  JSON.stringify({ name, processes: [{ key: 'web', ports: [1], cmd: 'node -e ""' }] })

/** Writes `text` as `file` in the temp dir and returns its path. */
const write = (file: string, text: string): string => {
  fs.writeFileSync(path.join(dir, file), text)
  return path.join(dir, file)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flotilla-registry-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('Registry', () => {
  it('names apps after their config and keeps a broken one with its problems', () => {
    const registry = new Registry([
      write('a.yaml', config('My App')),
      write('b.yaml', config('My App')),
      write('broken.yaml', 'name: Broken\n'),
      path.join(dir, 'missing.yaml')
    ])

    expect(registry.list().map((entry) => entry.id)).toEqual([
      'my-app',
      'my-app-2',
      'broken',
      'missing'
    ])
    expect(registry.get('broken')?.problems).toEqual([expect.stringMatching(/processes/)])
    expect(registry.get('missing')?.problems).toEqual([expect.stringMatching(/cannot read/)])
    expect(registry.get('nobody')).toBeNull()
  })

  it('saves only a valid config, then reloads', () => {
    const file = write('app.yaml', config('Before'))
    const registry = new Registry([file])
    const entry = registry.get('before')
    if (entry === null) throw new Error('not loaded')

    expect(registry.save(entry, 'name: After\n')).toMatchObject({ ok: false })
    expect(registry.text(entry)).toBe(config('Before'))

    expect(registry.save(entry, config('After'))).toMatchObject({ ok: true })
    expect(registry.list().map((e) => e.id)).toEqual(['after'])
  })
})
