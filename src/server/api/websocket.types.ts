export interface Frame {
  fin: boolean
  opcode: number
  payload: Buffer
}

export interface Parsed {
  frame: Frame
  rest: Buffer
}
