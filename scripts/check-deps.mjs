import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Installs dependencies only when they are not already the ones the lockfile asks for.
 *
 * `npm ci` is the right install for this repo -- it is the one that guarantees the tree matches the
 * lockfile -- but it deletes `node_modules` before it starts, and a delete that fails part-way is
 * what makes it dangerous to run on every `npm run dev`: a momentary lock on a freshly written
 * native binary (an antivirus or a file watcher will take one) leaves a half-emptied tree behind,
 * and the app then fails for no stated reason.
 *
 * The stamp below is the whole up-to-date test, and it is trustworthy for two reasons: it is
 * written only after an install has actually succeeded, and it lives inside `node_modules`, so an
 * install that empties the tree and then fails takes the stamp with it. A half-installed tree
 * therefore cannot present a valid stamp, which is why nothing here inspects the tree's contents.
 *
 * It keys on the lockfile's contents, not its timestamp: restoring the same file from git rewrites
 * its mtime, and reinstalling over that is the destructive no-op this exists to avoid.
 *
 * When it does install, it removes `node_modules` itself first, retrying past transient locks, so
 * npm always starts from nothing. That is the same delete npm would do, done in the one place that
 * can retry it, and it leaves nothing of a previous failure behind for the next run to trip over.
 *
 * `--accept` records the current tree as matching without installing, for the case where the tree
 * was put there by something other than this script (`npm install` to repair one, say).
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lockfile = path.join(ROOT, 'package-lock.json')
const modules = path.join(ROOT, 'node_modules')
const stamp = path.join(modules, '.check-deps-stamp')

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

const declared = read(lockfile)
if (declared === null) {
  console.log('check-deps: no package-lock.json, leaving the install to npm')
  process.exit(0)
}
const wanted = crypto.createHash('sha256').update(declared).digest('hex')

if (process.argv.includes('--accept')) {
  fs.mkdirSync(modules, { recursive: true })
  fs.writeFileSync(stamp, wanted)
  console.log('check-deps: recorded the current node_modules as matching package-lock.json')
  process.exit(0)
}

const installed = read(stamp)
if (installed === wanted) {
  console.log('check-deps: dependencies match package-lock.json, skipping npm ci')
  process.exit(0)
}

console.log(
  installed === null
    ? 'check-deps: no record of a completed install, reinstalling'
    : 'check-deps: package-lock.json has changed since the last install, reinstalling'
)

try {
  // maxRetries is the point of doing this here: it rides out the transient lock that leaves npm's
  // own delete half-done.
  fs.rmSync(modules, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
} catch (error) {
  console.error(`check-deps: could not remove node_modules (${error.code ?? error.message})`)
  console.error(
    'check-deps: something is holding a file in it -- close what is using the app, then retry'
  )
  process.exit(1)
}

// Deliberately not --silent: a failing install used to report nothing at all, which made a
// half-deleted node_modules look like the app simply refusing to start.
const install = spawnSync('npm', ['ci', '--cache', '.npm', '--no-audit'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

if (install.status === 0) {
  fs.writeFileSync(stamp, wanted)
}

process.exit(install.status ?? 1)
