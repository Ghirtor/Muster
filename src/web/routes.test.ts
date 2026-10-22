import { hrefOf, parseRoute } from './routes'

describe('routes', () => {
  it.each([
    ['', { page: 'fleet' }],
    ['#/', { page: 'fleet' }],
    ['#/apps/demo', { page: 'app', id: 'demo' }],
    ['#/apps/my%20app/config', { page: 'config', id: 'my app' }],
    ['#/nowhere', { page: 'fleet' }]
  ])('reads %p', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route)
  })

  it('writes what it reads', () => {
    for (const route of [
      { page: 'app', id: 'a b' },
      { page: 'config', id: 'x' }
    ] as const) {
      expect(parseRoute(hrefOf(route))).toEqual(route)
    }
  })
})
