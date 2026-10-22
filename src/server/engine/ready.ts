import type { ReadyCheck } from './config.types'
import { allUp } from './launch'
import type { Output } from './output.types'

interface CdpTarget {
  type?: string
  url?: string
  webSocketDebuggerUrl?: string
}

/** The page targets of a CDP `/json/list`, without DevTools' own pages. */
export const pageTargets = (list: unknown): CdpTarget[] =>
  Array.isArray(list)
    ? (list as CdpTarget[]).filter(
        (target) =>
          target.type === 'page' &&
          typeof target.webSocketDebuggerUrl === 'string' &&
          target.url?.startsWith('devtools://') !== true
      )
    : []

/** The expression a page evaluates: the first of `anyOf` its rendered text shows, or null. */
export const showsExpression = (anyOf: string[]): string =>
  `(() => { const text = document.body ? document.body.innerText : ''; ` +
  `return ${JSON.stringify(anyOf)}.find((label) => text.includes(label)) ?? null })()`

/** Evaluates `expression` in the page behind `url`, or null when it does not answer in time. */
const evaluate = async (url: string, expression: string, timeoutMs: number): Promise<unknown> =>
  await new Promise((resolve) => {
    const socket = new WebSocket(url)
    const finish = (value: unknown): void => {
      clearTimeout(timer)
      socket.close()
      resolve(value)
    }
    const timer = setTimeout(() => {
      finish(null)
    }, timeoutMs)
    socket.addEventListener('open', () => {
      const params = { expression, returnByValue: true }
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params }))
    })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number
        result?: { result?: { value?: unknown } }
      }
      if (message.id === 1) finish(message.result?.result?.value ?? null)
    })
    socket.addEventListener('error', () => {
      finish(null)
    })
  })

/**
 * The first of `anyOf` that a page behind the CDP endpoint on `port` shows, or null. The debug port
 * opens before the page has loaded, so a listening port says nothing about whether the app can be
 * driven; text the user would click proves it has rendered.
 */
export const cdpShows = async (port: number, anyOf: string[]): Promise<string | null> => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2000)
    })
    for (const target of pageTargets(await response.json())) {
      const found = await evaluate(target.webSocketDebuggerUrl ?? '', showsExpression(anyOf), 3000)
      if (typeof found === 'string') return found
    }
  } catch {
    return null
  }
  return null
}

/** What a check waits for, as `up` prints it. */
export const describeCheck = (check: ReadyCheck): string =>
  check.kind === 'ports'
    ? `ports ${check.ports.join(', ')}`
    : `:${check.port} shows ${check.anyOf.map((label) => `"${label}"`).join(' or ')}`

/** Waits for one check until it passes or its timeout runs out. */
export const waitReady = async (
  check: ReadyCheck,
  out: Output,
  pollMs = 1000
): Promise<boolean> => {
  out.write(`  ready: ${describeCheck(check)} ...`)
  const deadline = Date.now() + check.timeoutMs
  for (;;) {
    if (check.kind === 'ports') {
      if (await allUp(check.ports)) break
    } else {
      const found = await cdpShows(check.port, check.anyOf)
      if (found !== null) {
        out.write(` "${found}"`)
        break
      }
    }
    if (Date.now() >= deadline) {
      out.write(' TIMEOUT\n')
      return false
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  out.write(' ok\n')
  return true
}
