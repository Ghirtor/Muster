import net from 'node:net'

import { probe } from './probe'

describe('probe', () => {
  it('sees a port that accepts connections', async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('no port')

    await expect(probe(address.port)).resolves.toBe(true)

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
  })

  it('reports a closed port as down', async () => {
    await expect(probe(1, 200)).resolves.toBe(false)
  })
})
