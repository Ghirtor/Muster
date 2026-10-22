import { runCommand } from './command'

/**
 * `flotilla status|up|release|down`: rig.mjs's commands, flags and exit codes (0 ok, 1 failed,
 * 2 usage, 3 busy) over any app's config, so the rig-ctl skill can call it unchanged.
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
