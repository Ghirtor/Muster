import { createHash } from 'node:crypto'
import type http from 'node:http'
import type { Duplex } from 'node:stream'

import type { Frame, Parsed } from './websocket.types'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const OP_CONTINUATION = 0x0
const OP_TEXT = 0x1
const OP_BINARY = 0x2
const OP_CLOSE = 0x8
const OP_PING = 0x9
const OP_PONG = 0xa
const MAX_MESSAGE = 1024 * 1024

/** The `Sec-WebSocket-Accept` answer to a client's key (RFC 6455 §4.2.2). */
export const acceptKey = (key: string): string =>
  createHash('sha1').update(`${key}${GUID}`).digest('base64')

/** One frame as a server sends it: final and unmasked. */
export const encodeFrame = (opcode: number, payload: Buffer): Buffer => {
  const length = payload.length
  const header =
    length < 126 ? Buffer.alloc(2) : length < 65_536 ? Buffer.alloc(4) : Buffer.alloc(10)
  header[0] = 0x80 | opcode
  if (length < 126) {
    header[1] = length
  } else if (length < 65_536) {
    header[1] = 126
    header.writeUInt16BE(length, 2)
  } else {
    header[1] = 127
    header.writeBigUInt64BE(BigInt(length), 2)
  }
  return Buffer.concat([header, payload])
}

/**
 * The first frame in `data`, unmasked, and what follows it; null while the frame is incomplete.
 * Throws on a frame no client may send: unmasked, or larger than a dashboard ever needs.
 */
export const parseFrame = (data: Buffer): Parsed | null => {
  if (data.length < 2) return null
  const first = data.readUInt8(0)
  const second = data.readUInt8(1)
  if ((second & 0x80) === 0) throw new Error('client frames must be masked')
  let length = second & 0x7f
  let offset = 2
  if (length === 126) {
    if (data.length < 4) return null
    length = data.readUInt16BE(2)
    offset = 4
  } else if (length === 127) {
    if (data.length < 10) return null
    length = Number(data.readBigUInt64BE(2))
    offset = 10
  }
  if (length > MAX_MESSAGE) throw new Error('frame too large')
  if (data.length < offset + 4 + length) return null
  const mask = data.subarray(offset, offset + 4)
  const payload = Buffer.from(data.subarray(offset + 4, offset + 4 + length))
  for (let i = 0; i < payload.length; i++) payload[i] = (payload[i] ?? 0) ^ (mask[i % 4] ?? 0)
  return {
    frame: { fin: (first & 0x80) !== 0, opcode: first & 0x0f, payload },
    rest: data.subarray(offset + 4 + length)
  }
}

/**
 * One WebSocket client over an upgraded socket: text messages in and out, pings answered, and
 * fragmented messages put back together. Node has a WebSocket client but no server, and this is
 * the whole of what the dashboard needs, so it is written here rather than added as a dependency.
 */
export class WebSocketPeer {
  private buffer: Buffer = Buffer.alloc(0)
  private fragments: Buffer[] = []
  private closed = false
  private readonly messageListeners: ((text: string) => void)[] = []
  private readonly closeListeners: (() => void)[] = []

  constructor(private readonly socket: Duplex) {
    socket.on('data', (chunk: Buffer) => {
      this.receive(chunk)
    })
    socket.on('close', () => {
      this.finish()
    })
    socket.on('error', () => {
      this.finish()
    })
  }

  /** Whether messages can still be sent. */
  get open(): boolean {
    return !this.closed
  }

  /** Calls `listener` with each text message the client sends. */
  onMessage(listener: (text: string) => void): void {
    this.messageListeners.push(listener)
  }

  /** Calls `listener` once the connection is gone, however it went. */
  onClose(listener: () => void): void {
    this.closeListeners.push(listener)
  }

  /** Sends one text message; a no-op once closed. */
  send(text: string): void {
    if (this.closed) return
    this.socket.write(encodeFrame(OP_TEXT, Buffer.from(text, 'utf8')))
  }

  /** Sends a close frame and ends the socket. */
  close(code = 1000): void {
    if (this.closed) return
    const payload = Buffer.alloc(2)
    payload.writeUInt16BE(code, 0)
    this.socket.end(encodeFrame(OP_CLOSE, payload))
    this.finish()
  }

  /** Marks the peer closed and tells the listeners, once. */
  private finish(): void {
    if (this.closed) return
    this.closed = true
    this.socket.destroy()
    for (const listener of this.closeListeners) listener()
  }

  /** Reads every complete frame buffered so far; a protocol error closes the connection. */
  private receive(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    try {
      for (
        let parsed = parseFrame(this.buffer);
        parsed !== null;
        parsed = parseFrame(this.buffer)
      ) {
        this.buffer = parsed.rest
        this.handle(parsed.frame)
        if (this.closed) return
      }
    } catch {
      this.close(1002)
    }
  }

  /** Acts on one frame: control frames at once, data frames once their message is whole. */
  private handle(frame: Frame): void {
    if (frame.opcode === OP_CLOSE) {
      this.close()
      return
    }
    if (frame.opcode === OP_PING) {
      this.socket.write(encodeFrame(OP_PONG, frame.payload))
      return
    }
    if (frame.opcode === OP_PONG) return
    if (
      frame.opcode !== OP_TEXT &&
      frame.opcode !== OP_BINARY &&
      frame.opcode !== OP_CONTINUATION
    ) {
      throw new Error(`unknown opcode ${frame.opcode}`)
    }
    this.fragments.push(frame.payload)
    if (!frame.fin) return
    const message = Buffer.concat(this.fragments)
    this.fragments = []
    if (message.length > MAX_MESSAGE) throw new Error('message too large')
    for (const listener of this.messageListeners) listener(message.toString('utf8'))
  }
}

/**
 * Completes the opening handshake for an `upgrade` request and returns its peer, or answers 400
 * and returns null when the request is not a WebSocket handshake.
 */
export const acceptUpgrade = (
  request: http.IncomingMessage,
  socket: Duplex
): WebSocketPeer | null => {
  const key = request.headers['sec-websocket-key']
  const upgrade = request.headers.upgrade?.toLowerCase()
  if (typeof key !== 'string' || upgrade !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    return null
  }
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      '',
      ''
    ].join('\r\n')
  )
  return new WebSocketPeer(socket)
}
