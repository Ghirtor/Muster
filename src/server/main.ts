import path from 'node:path'

import { createSupervisor } from './api/supervisor'
import { musterHome } from './engine/config'

const PORT = Number(process.env.MUSTER_PORT ?? 4871)

/**
 * How to run the CLI beside this file: the same node with the same loaders (swc-node in
 * development, none once built), minus watch and inspector flags, which would make each action a
 * server.
 */
const cliCommand = (): string[] => {
  const flags = process.execArgv.filter((flag) => !/^--(watch|inspect)/.test(flag))
  const cli = path.join(import.meta.dirname, `cli${path.extname(import.meta.filename)}`)
  return [process.execPath, ...flags, cli]
}

/**
 * The supervisor: the API over every app registered in the Muster home (`MUSTER_HOME`, else
 * `~/.muster`), and with `MUSTER_WEB_ROOT` set (the desktop app sets it) the built dashboard too.
 */
const main = async (): Promise<void> => {
  const { server } = await createSupervisor({
    home: musterHome(),
    cli: cliCommand(),
    ...(process.env.MUSTER_WEB_ROOT === undefined ? {} : { webRoot: process.env.MUSTER_WEB_ROOT })
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`muster supervisor on http://127.0.0.1:${PORT}`)
  })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
