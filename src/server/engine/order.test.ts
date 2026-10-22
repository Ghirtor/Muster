import type { ProcessConfig } from './config.types'
import { launchOrder } from './order'

const proc = (key: string, after: string[] = []): ProcessConfig => ({
  key,
  label: key,
  ports: [],
  cwd: '.',
  cmd: 'run',
  env: {},
  after,
  timeoutMs: 1000,
  onFailure: []
})

const keys = (processes: ProcessConfig[]): string[] =>
  launchOrder(processes).order.map((p) => p.key)

describe('launchOrder', () => {
  it('keeps the listed order when nothing waits', () => {
    expect(keys([proc('a'), proc('b'), proc('c')])).toEqual(['a', 'b', 'c'])
  })

  it('moves a process after what it waits on', () => {
    expect(
      keys([proc('api', ['vision', 'bridge']), proc('vision'), proc('bridge'), proc('converter')])
    ).toEqual(['vision', 'bridge', 'api', 'converter'])
  })

  it('reports a circle and what is stuck behind it', () => {
    const result = launchOrder([proc('a', ['b']), proc('b', ['a']), proc('c', ['a']), proc('d')])

    expect(result.order.map((p) => p.key)).toEqual(['d'])
    expect(result.cycle).toEqual(['a', 'b', 'c'])
  })
})
