import type { ClientMessage, HubOptions, ServerMessage } from './hub.types'
import type { Jobs } from './jobs'
import { readRange, sizeOf, tailLog } from './logs'
import type { Registry } from './registry'
import type { WebSocketPeer } from './websocket'

interface Follower {
  app: string
  key: string
  file: string
  offset: number
  timer: NodeJS.Timeout
}

const LOG_TOPIC = /^log:([^:]+):([^:]+)$/

/** Whether `value` is a subscribe or unsubscribe message. */
const isClientMessage = (value: unknown): value is ClientMessage => {
  const message = value as Partial<ClientMessage> | null
  return (
    typeof message === 'object' &&
    message !== null &&
    (message.type === 'subscribe' || message.type === 'unsubscribe') &&
    Array.isArray(message.topics) &&
    message.topics.every((topic) => typeof topic === 'string')
  )
}

/**
 * The WebSocket side of the API. A client subscribes to topics: `status` (every app's snapshot,
 * sent whole on subscribing and then only when it changes), `jobs` (actions starting, printing and
 * ending) and `log:<app>:<key>` (a process log's tail, then what is appended to it). Nothing is
 * polled while nobody listens to it.
 */
export class Hub {
  private readonly peers = new Map<WebSocketPeer, Set<string>>()
  private readonly followers = new Map<string, Follower>()
  private readonly sent = new Map<string, string>()
  private statusTimer: NodeJS.Timeout | null = null
  private ticking = false
  private readonly unsubscribeJobs: () => void

  constructor(
    private readonly registry: Registry,
    jobs: Jobs,
    private readonly options: HubOptions = {}
  ) {
    this.unsubscribeJobs = jobs.onEvent((event) => {
      this.publish('jobs', event)
      if (event.type === 'job' && event.job.state !== 'running') void this.tick()
    })
  }

  /** Takes a new client. */
  add(peer: WebSocketPeer): void {
    this.peers.set(peer, new Set())
    peer.onMessage((text) => {
      this.receive(peer, text)
    })
    peer.onClose(() => {
      const topics = this.peers.get(peer) ?? new Set<string>()
      this.peers.delete(peer)
      for (const topic of topics) this.release(topic)
    })
  }

  /** Closes every client and stops every timer. */
  close(): void {
    this.unsubscribeJobs()
    for (const peer of [...this.peers.keys()]) peer.close(1001)
    if (this.statusTimer !== null) clearInterval(this.statusTimer)
    this.statusTimer = null
    for (const follower of this.followers.values()) clearInterval(follower.timer)
    this.followers.clear()
  }

  /** Acts on one client message; anything malformed is answered with an error. */
  private receive(peer: WebSocketPeer, text: string): void {
    let message: unknown
    try {
      message = JSON.parse(text)
    } catch {
      message = null
    }
    if (!isClientMessage(message)) {
      this.send(peer, { type: 'error', message: 'expected {type: subscribe|unsubscribe, topics}' })
      return
    }
    const topics = this.peers.get(peer)
    if (topics === undefined) return
    for (const topic of message.topics) {
      if (message.type === 'unsubscribe') {
        if (topics.delete(topic)) this.release(topic)
      } else if (!topics.has(topic) && this.claim(peer, topic)) {
        topics.add(topic)
      }
    }
  }

  /**
   * Starts what `topic` needs and sends `peer` its current state. False for an unknown topic. The
   * first status subscriber gets it from the first tick, which runs after `peer` is subscribed.
   */
  private claim(peer: WebSocketPeer, topic: string): boolean {
    if (topic === 'jobs') return true
    if (topic === 'status') {
      if (this.statusTimer === null) {
        this.statusTimer = setInterval(() => void this.tick(), this.options.statusMs ?? 2000)
        void this.tick()
      } else {
        void this.sendAllStatus(peer)
      }
      return true
    }
    const match = LOG_TOPIC.exec(topic)
    const entry = this.registry.get(match?.at(1) ?? '')
    const key = match?.at(2) ?? ''
    if (entry?.problems !== null || !entry.config.processes.some((p) => p.key === key)) {
      this.send(peer, { type: 'error', message: `unknown topic ${topic}` })
      return false
    }
    const file = this.registry.rigOf(entry).logOf(key)
    const follower = this.followers.get(topic) ?? this.follow(topic, entry.id, key, file)
    const { text } = tailLog(follower.file)
    this.send(peer, { type: 'log', app: entry.id, key, text, reset: true })
    return true
  }

  /** Stops what `topic` needed once nobody listens to it. */
  private release(topic: string): void {
    const listened = [...this.peers.values()].some((topics) => topics.has(topic))
    if (listened) return
    if (topic === 'status' && this.statusTimer !== null) {
      clearInterval(this.statusTimer)
      this.statusTimer = null
      this.sent.clear()
    }
    const follower = this.followers.get(topic)
    if (follower !== undefined) {
      clearInterval(follower.timer)
      this.followers.delete(topic)
    }
  }

  /** Starts following a process log from its current end. */
  private follow(topic: string, app: string, key: string, file: string): Follower {
    const follower: Follower = {
      app,
      key,
      file,
      offset: sizeOf(file),
      timer: setInterval(() => {
        this.advance(topic, follower)
      }, this.options.logMs ?? 500)
    }
    this.followers.set(topic, follower)
    return follower
  }

  /** Sends what was appended to a followed log; a file that shrank was restarted, so resend it. */
  private advance(topic: string, follower: Follower): void {
    const size = sizeOf(follower.file)
    if (size === follower.offset) return
    const reset = size < follower.offset
    const text = readRange(follower.file, reset ? 0 : follower.offset, size)
    follower.offset = size
    this.publish(topic, { type: 'log', app: follower.app, key: follower.key, text, reset })
  }

  /** Every app's state as a status message. */
  private async statusMessages(): Promise<ServerMessage[]> {
    return await Promise.all(
      this.registry.list().map(async (entry): Promise<ServerMessage> => {
        if (entry.problems !== null) {
          return { type: 'status', app: entry.id, snapshot: null, problems: entry.problems }
        }
        const snapshot = await this.registry.rigOf(entry).snapshot()
        return { type: 'status', app: entry.id, snapshot, problems: null }
      })
    )
  }

  /** Sends one client every app's state. */
  private async sendAllStatus(peer: WebSocketPeer): Promise<void> {
    for (const message of await this.statusMessages()) this.send(peer, message)
  }

  /** Reads every app's state and sends the ones that changed; skipped while one is in flight. */
  private async tick(): Promise<void> {
    if (this.ticking || this.statusTimer === null) return
    this.ticking = true
    try {
      for (const message of await this.statusMessages()) {
        if (message.type !== 'status') continue
        const json = JSON.stringify(message)
        if (this.sent.get(message.app) === json) continue
        this.sent.set(message.app, json)
        this.publish('status', message)
      }
    } finally {
      this.ticking = false
    }
  }

  /** Sends `message` to every client subscribed to `topic`. */
  private publish(topic: string, message: ServerMessage): void {
    for (const [peer, topics] of this.peers) if (topics.has(topic)) this.send(peer, message)
  }

  /** Sends one message to one client. */
  private send(peer: WebSocketPeer, message: ServerMessage): void {
    peer.send(JSON.stringify(message))
  }
}
