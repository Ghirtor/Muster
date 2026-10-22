import os from 'node:os'
import path from 'node:path'

import {
  ConfigError,
  expandPath,
  expandVars,
  loadConfig,
  parseConfig,
  parseDuration,
  slug
} from './config'

const DEMO = path.resolve('design/sample.yaml')

const problemsOf = (text: string): string[] => {
  try {
    parseConfig(text, 'test.yaml')
  } catch (error) {
    if (error instanceof ConfigError) return error.problems
    throw error
  }
  return []
}

describe('loadConfig', () => {
  it('reads the Demo rig as rig.mjs runs it', () => {
    const config = loadConfig(DEMO)

    expect(config.name).toBe('Demo')
    expect(config.instances.mode).toBe('one-per-machine')
    expect(config.instances.lock).toBe(path.join(os.homedir(), '.rig-ctl', 'lock.json'))
    expect(config.instances.staleAfterMs).toBe(20 * 60_000)
    expect(config.processes.map((p) => p.key)).toEqual([
      'vision',
      'bridge',
      'converter',
      'api',
      'simulator',
      'tauri'
    ])
    expect(config.processes.flatMap((p) => p.ports)).toEqual([
      8766, 8767, 8765, 1234, 1232, 5173, 9222
    ])
    expect(config.buildGroups.dotnet).toEqual({
      sequential: true,
      cmd: 'dotnet build {project} --nologo -v q'
    })
    expect(config.logs).toContain('{key}')
  })

  it('fills repair steps from the variables a process gives its repair', () => {
    const vision = loadConfig(DEMO).processes.find((p) => p.key === 'vision')
    const venv = vision?.onFailure.at(0)

    expect(venv?.steps.map((step) => step.run)).toEqual([
      'python -m venv .venv',
      '.venv\\Scripts\\python.exe -m pip install -e ".{extras}"'
    ])
    expect(venv?.vars).toEqual({ extras: '[dev,service]' })
    expect(venv?.match.test('ModuleNotFoundError: x')).toBe(true)
  })

  it('reads the slow start and the readiness checks', () => {
    const config = loadConfig(DEMO)
    const tauri = config.processes.find((p) => p.key === 'tauri')

    expect(tauri?.slow).toEqual({ startFirst: true, timeoutMs: 15 * 60_000 })
    expect(tauri?.env.DEMO_KEEP_PAGE_VISIBLE).toBe(process.env.DEMO_KEEP_PAGE_VISIBLE ?? '1')
    expect(config.ready.at(0)).toMatchObject({
      kind: 'ports',
      ports: [8766, 8767, 8765, 1234, 1232, 5173, 9222]
    })
    expect(config.ready.at(1)).toMatchObject({
      kind: 'cdp',
      port: 9222,
      anyOf: ['Draw', 'Connect']
    })
  })

  it('reports a missing file as a config error', () => {
    expect(() => loadConfig('missing.yaml')).toThrow(ConfigError)
  })
})

describe('parseConfig', () => {
  const minimal = (processes: string): string => `name: App\nprocesses:\n${processes}`

  it('fills defaults for a minimal config', () => {
    const config = parseConfig(minimal('  - { key: a, ports: [4000], cmd: run }'), '/apps/app.yaml')

    expect(config.repo).toBe(path.resolve('/apps'))
    expect(config.instances.mode).toBe('one-per-machine')
    expect(config.processes.at(0)).toMatchObject({
      label: 'a',
      cwd: '.',
      after: [],
      timeoutMs: 120_000
    })
  })

  it('lists every problem at once', () => {
    const problems = problemsOf(
      minimal(
        [
          '  - { key: a, ports: [70000], cmd: run, colour: red }',
          '  - { key: a, ports: [4001], cmd: run, after: [nobody] }'
        ].join('\n')
      )
    )

    expect(problems.length).toBeGreaterThanOrEqual(3)
    expect(problems.join('\n')).toMatch(/70000/)
    expect(problems.join('\n')).toMatch(/colour/)
    expect(problems.join('\n')).toMatch(/nobody/)
  })

  it('refuses processes that wait on each other', () => {
    const problems = problemsOf(
      minimal(
        [
          '  - { key: a, ports: [4000], cmd: run, after: [b] }',
          '  - { key: b, ports: [4001], cmd: run, after: [a] }'
        ].join('\n')
      )
    )

    expect(problems.join('\n')).toMatch(/circle: a → b/)
  })

  it('refuses a logs path without {key}', () => {
    expect(
      problemsOf(`${minimal('  - { key: a, ports: [4000], cmd: run }')}\nlogs: out.log`)
    ).toEqual([expect.stringMatching(/\{key\}/)])
  })

  it('refuses a repair placeholder with no value', () => {
    const problems = problemsOf(
      minimal(
        '  - { key: a, ports: [4000], cmd: run, onFailure: [{ match: x, run: "go {missing}" }] }'
      )
    )

    expect(problems.join('\n')).toMatch(/\{missing\} has no value/)
  })
})

describe('parseDuration', () => {
  it.each([
    [90, 90_000],
    ['20m', 1_200_000],
    ['1.5s', 1500],
    ['250ms', 250],
    ['2h', 7_200_000],
    ['soon', null],
    [-1, null]
  ])('reads %p as %p ms', (value, expected) => {
    expect(parseDuration(value)).toBe(expected)
  })
})

describe('expandVars and expandPath', () => {
  it('uses the environment, then the default', () => {
    expect(expandVars('${A:-x}-${B:-y}', { A: 'set' })).toBe('set-y')
  })

  it('expands ~ and %NAME% in paths', () => {
    expect(path.resolve(expandPath('~/lock.json', {}))).toBe(path.join(os.homedir(), 'lock.json'))
    expect(expandPath('%ROOT%/logs', { ROOT: '/data' })).toBe('/data/logs')
  })
})

describe('slug', () => {
  it('makes a directory name of an app name', () => {
    expect(slug('Demo Rig (dev)')).toBe('demo-rig-dev')
  })
})
