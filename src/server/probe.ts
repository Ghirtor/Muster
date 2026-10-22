import net from 'node:net'

/**
 * Whether something accepts a connection on `port`, on either loopback family. Vite binds
 * IPv6-only ([::1]) while the API binds IPv4-only, and Simulator speaks raw TCP with no HTTP —
 * a connect attempt is the only check that covers all three (see rig.mjs).
 */
export const probe = async (port: number, timeoutMs = 500): Promise<boolean> => {
  const one = async (host: string): Promise<boolean> =>
    await new Promise((resolve) => {
      const socket = net.createConnection({ host, port })
      let settled = false
      const done = (value: boolean): void => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(value)
      }
      socket.setTimeout(timeoutMs)
      socket.once('connect', () => {
        done(true)
      })
      socket.once('timeout', () => {
        done(false)
      })
      socket.once('error', () => {
        done(false)
      })
    })
  const results = await Promise.all([one('127.0.0.1'), one('::1')])
  return results.some(Boolean)
}
