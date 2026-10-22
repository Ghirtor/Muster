import type { Job, Listener, ServerMessage } from './musterApi.types'

const listeners = new Map<string, Set<Listener>>()
let socket: WebSocket | null = null
let retry: ReturnType<typeof setTimeout> | null = null

/** The topic a server message belongs to. */
const topicOf = (message: ServerMessage): string | null => {
  if (message.type === 'status') return 'status'
  if (message.type === 'job' || message.type === 'job-output') return 'jobs'
  if (message.type === 'log') return `log:${message.app}:${message.key}`
  return null
}

/** Sends a (un)subscribe message if the socket is open; on opening it subscribes to everything. */
const tell = (type: 'subscribe' | 'unsubscribe', topics: string[]): void => {
  if (topics.length > 0 && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, topics }))
  }
}

/** Opens the one shared socket, and opens it again a second after it drops while anyone listens. */
const connect = (): void => {
  if (socket !== null || typeof WebSocket === 'undefined') return
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  const opened = new WebSocket(`${scheme}://${location.host}/api/ws`)
  socket = opened
  opened.addEventListener('open', () => {
    tell('subscribe', [...listeners.keys()])
  })
  opened.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as ServerMessage
    const topic = topicOf(message)
    if (topic === null) return
    for (const listener of listeners.get(topic) ?? []) listener(message)
  })
  opened.addEventListener('close', () => {
    socket = null
    if (listeners.size > 0 && retry === null) {
      retry = setTimeout(() => {
        retry = null
        if (listeners.size > 0) connect()
      }, 1000)
    }
  })
}

/**
 * Listens to WebSocket topics (`status`, `jobs`, `log:<app>:<key>`) over one socket shared by the
 * whole page. Each topic is subscribed while it has a listener; the returned function stops this one.
 */
export const subscribe = (topics: string[], listener: Listener): VoidFunction => {
  const fresh = topics.filter((topic) => !listeners.has(topic))
  for (const topic of topics) {
    const set = listeners.get(topic) ?? new Set<Listener>()
    set.add(listener)
    listeners.set(topic, set)
  }
  connect()
  tell('subscribe', fresh)
  return () => {
    const emptied = topics.filter((topic) => {
      const set = listeners.get(topic)
      set?.delete(listener)
      if (set?.size !== 0) return false
      listeners.delete(topic)
      return true
    })
    tell('unsubscribe', emptied)
  }
}

/** Resolves with a job once it has ended, whether it ended before the call (`read` says) or after. */
export const waitForJob = async (id: string, read: () => Promise<Job>): Promise<Job> =>
  await new Promise((resolve, reject) => {
    const stop = subscribe(['jobs'], (message) => {
      if (message.type === 'job' && message.job.id === id && message.job.state !== 'running') {
        stop()
        resolve(message.job)
      }
    })
    read().then(
      (job) => {
        if (job.state === 'running') return
        stop()
        resolve(job)
      },
      (error: unknown) => {
        stop()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  })
