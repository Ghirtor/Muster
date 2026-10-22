import fs from 'node:fs'
import path from 'node:path'

import { createSupervisor } from './api/supervisor'

const PORT = Number(process.env.FLOTILLA_PORT ?? 4871)

/**
 * The configs the supervisor serves: `FLOTILLA_CONFIGS`, a path list, else whichever of
 * `flotilla.yaml` and `design/sample.yaml` sit in the working directory.
 */
const configFiles = (): string[] => {
  const listed = process.env.FLOTILLA_CONFIGS
  if (listed !== undefined && listed.trim() !== '') {
    return listed.split(path.delimiter).filter((file) => file.trim() !== '')
  }
  return ['flotilla.yaml', path.join('design', 'sample.yaml')]
    .map((file) => path.resolve(file))
    .filter((file) => fs.existsSync(file))
}

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
 * The supervisor: the API over every configured app, and with `FLOTILLA_WEB_ROOT` set (the desktop
 * app sets it) the built dashboard too.
 */
const main = async (): Promise<void> => {
  const { server } = await createSupervisor({
    configs: configFiles(),
    cli: cliCommand(),
    ...(process.env.FLOTILLA_WEB_ROOT === undefined
      ? {}
      : { webRoot: process.env.FLOTILLA_WEB_ROOT })
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`flotilla supervisor on http://127.0.0.1:${PORT}`)
  })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
