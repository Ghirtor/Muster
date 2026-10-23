import { runCommand } from './command'

/**
 * `muster status|up|release|down --app <id>`: rig.mjs's commands, flags and exit codes (0 ok,
 * 1 failed, 2 usage, 3 busy) over any registered app, plus `muster register <file>` and
 * `muster apps` to register and list them.
 */
const main = async (): Promise<void> => {
  try {
    process.exitCode = await runCommand(process.argv.slice(2), {
      out: process.stdout,
      err: process.stderr,
      env: process.env,
      cwd: process.cwd()
    })
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}

await main()
