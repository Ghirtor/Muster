import { acceptKey, encodeFrame, parseFrame } from './websocket'

/** A frame as a client sends it: masked with `mask`. */
const clientFrame = (opcode: number, text: string, fin = true, mask = [1, 2, 3, 4]): Buffer => {
  const payload = Buffer.from(text, 'utf8')
  const masked = payload.map((byte, i) => byte ^ (mask[i % 4] ?? 0))
  const header =
    payload.length < 126
      ? Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | payload.length])
      : Buffer.from([
          (fin ? 0x80 : 0) | opcode,
          0x80 | 126,
          payload.length >> 8,
          payload.length & 0xff
        ])
  return Buffer.concat([header, Buffer.from(mask), masked])
}

describe('acceptKey', () => {
  it('answers the handshake example of RFC 6455', () => {
    expect(acceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=')
  })
})

describe('parseFrame', () => {
  it('unmasks a client text frame and keeps what follows it', () => {
    const data = Buffer.concat([clientFrame(0x1, 'hello'), Buffer.from([0x81])])
    const parsed = parseFrame(data)

    expect(parsed?.frame).toEqual({ fin: true, opcode: 0x1, payload: Buffer.from('hello') })
    expect(parsed?.rest).toEqual(Buffer.from([0x81]))
  })

  it('reads a 16-bit length', () => {
    const text = 'x'.repeat(300)

    expect(parseFrame(clientFrame(0x1, text))?.frame.payload.toString()).toBe(text)
  })

  it('waits for the rest of an incomplete frame', () => {
    expect(parseFrame(clientFrame(0x1, 'hello').subarray(0, 6))).toBeNull()
    expect(parseFrame(Buffer.from([0x81]))).toBeNull()
  })

  it('refuses an unmasked frame', () => {
    expect(() => parseFrame(encodeFrame(0x1, Buffer.from('hi')))).toThrow(/masked/)
  })
})

describe('encodeFrame', () => {
  it.each([
    [5, 2],
    [300, 4],
    [70_000, 10]
  ])('frames %p bytes behind a %p-byte header', (length, header) => {
    const frame = encodeFrame(0x1, Buffer.alloc(length))

    expect(frame.length).toBe(length + header)
    expect(frame[0]).toBe(0x81)
  })
})
