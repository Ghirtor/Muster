export type Flags = Record<string, string | true>

export interface CommandIo {
  out: { write: (text: string) => void }
  err: { write: (text: string) => void }
  env: NodeJS.ProcessEnv
  cwd: string
}
