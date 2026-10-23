import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Registry } from './registry'

let dir: string
let home: string

const RECIPE = JSON.stringify({ processes: [{ key: 'web', ports: [1], cmd: 'node -e ""' }] })

/** Writes `text` as `file` under the temp dir and returns its path. */
const write = (file: string, text: string): string => {
  const target = path.join(dir, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, text)
  return target
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muster-registry-'))
  home = path.join(dir, 'home')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('Registry', () => {
  it('lists every registration by id and keeps a broken one with its problems', () => {
    write('home/apps/app.yaml', `name: App\nrepo: ${JSON.stringify(dir)}\n`)
    write('muster.yaml', RECIPE)
    write('home/apps/broken.yaml', 'name: Broken\n')
    write('home/apps/notes.txt', 'not a registration')

    const registry = new Registry(home)

    expect(registry.list().map((entry) => entry.id)).toEqual(['app', 'broken'])
    expect(registry.get('app')).toMatchObject({
      file: path.join(dir, 'muster.yaml'),
      problems: null
    })
    expect(registry.get('broken')?.problems).toEqual([expect.stringMatching(/no recipe is pinned/)])
    expect(registry.get('nobody')).toBeNull()
  })

  it('saves only a valid recipe, then reloads', () => {
    write('home/apps/app.yaml', `name: App\nrepo: ${JSON.stringify(dir)}\n`)
    write('muster.yaml', RECIPE)
    const registry = new Registry(home)
    const entry = registry.get('app')
    if (entry === null) throw new Error('not loaded')

    expect(registry.save(entry, 'name: App\n')).toMatchObject({ ok: false })
    expect(registry.text(entry)).toBe(RECIPE)

    const changed = RECIPE.replace('"web"', '"api"')
    expect(registry.save(entry, changed)).toMatchObject({ ok: true })
    expect(registry.get('app')?.config?.processes.map((p) => p.key)).toEqual(['api'])
  })

  it('lists an app whose recipe path is a folder with its problem', () => {
    write('home/apps/app.yaml', `name: App\nrepo: ${JSON.stringify(dir)}\nrecipe: folder\n`)
    fs.mkdirSync(path.join(dir, 'folder'))

    const registry = new Registry(home)

    expect(registry.get('app')).toMatchObject({ file: path.join(dir, 'folder'), config: null })
  })

  it('refuses a registration whose new name changes the id', () => {
    write(
      'home/apps/pinned.yaml',
      JSON.stringify({ name: 'Pinned', recipe: 'none.yaml', ...JSON.parse(RECIPE) })
    )
    const registry = new Registry(home)
    const entry = registry.get('pinned')
    if (entry === null) throw new Error('not loaded')
    const renamed = JSON.stringify({ name: 'Other', recipe: 'none.yaml', ...JSON.parse(RECIPE) })

    expect(registry.validate(entry, renamed)).toEqual({
      ok: false,
      problems: [expect.stringMatching(/id: other is not pinned's id/)]
    })
  })

  it('edits the registration when it pins the recipe', () => {
    const file = write(
      'home/apps/pinned.yaml',
      JSON.stringify({ name: 'Pinned', recipe: 'none.yaml', ...JSON.parse(RECIPE) })
    )
    const registry = new Registry(home)
    const entry = registry.get('pinned')
    if (entry === null) throw new Error('not loaded')

    expect(entry).toMatchObject({ file, registration: file, problems: null })
    expect(registry.validate(entry, 'name: Pinned\nrecipe: none.yaml\n')).toMatchObject({
      ok: false
    })
  })
})
