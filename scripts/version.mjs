import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Sets the next release's version on the checked-out branch:
 * `node scripts/version.mjs <x.y.z> <FEAT-n>`, or `version.sh` / `version.bat` with the same
 * arguments.
 *
 * It writes the version into `src-tauri/tauri.conf.json` (which names the installers) and
 * `package.json` (with `package-lock.json`), commits the three as `<FEAT-n>: Version <x.y.z>` and
 * pushes the branch. Once that commit reaches `main`, `.github/workflows/release.yml` tags it
 * `v<x.y.z>` and builds the installers, and refuses a version already tagged.
 *
 * It needs a branch (not a detached HEAD) and a clean working tree, and takes only a version above
 * the branch's current one that no tag has yet.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TAURI_CONF = path.join(ROOT, 'src-tauri', 'tauri.conf.json')
const PACKAGE = path.join(ROOT, 'package.json')
const LOCK = path.join(ROOT, 'package-lock.json')

const fail = (message) => {
  console.error(`version: ${message}`)
  process.exit(1)
}

const git = (...args) => {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  if (result.status !== 0) {
    fail(`git ${args.join(' ')} failed\n${(result.stderr || result.stdout).trim()}`)
  }
  return result.stdout.trim()
}

/** Rewrites the first `"version": "…"` in `file`, leaving the rest of its text as it was. */
const setVersion = (file, version) => {
  const text = fs.readFileSync(file, 'utf8')
  fs.writeFileSync(file, text.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`))
}

const [version, key] = process.argv.slice(2)
if (version === undefined || key === undefined) {
  fail('usage: version <x.y.z> <FEAT-n>, e.g. version 0.2.0 FEAT-12')
}
// The MSI takes only numeric versions, its major and minor at most 255 and its patch at most 65535.
const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
if (parts === null) {
  fail(`${version} is not a version like 0.2.0`)
}
if (Number(parts[1]) > 255 || Number(parts[2]) > 255 || Number(parts[3]) > 65535) {
  fail(`${version} is out of the MSI's range (255.255.65535)`)
}
if (!/^FEAT-\d+$/.test(key)) {
  fail(`${key} is not an issue key like FEAT-12`)
}
const tag = `v${version}`

const current = JSON.parse(fs.readFileSync(TAURI_CONF, 'utf8')).version
const order = (a, b) =>
  a.split('.').reduce((d, n, i) => d || Number(n) - Number(b.split('.')[i]), 0)
if (order(version, current) <= 0) {
  fail(`${version} is not above the current version ${current}`)
}

// A detached HEAD reads as `HEAD`, and has no branch to push.
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch === 'HEAD') {
  fail('HEAD is detached; switch to the branch the version goes on first')
}
if (git('status', '--porcelain') !== '') {
  fail('the working tree has changes; commit or stash them first')
}
git('fetch', 'origin', '--tags')
if (git('tag', '--list', tag) !== '') {
  fail(`${tag} is already released`)
}

setVersion(TAURI_CONF, version)
setVersion(PACKAGE, version)
// npm writes its lockfile as two-space JSON, so a round trip keeps it byte for byte.
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'))
lock.version = version
lock.packages[''].version = version
fs.writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`)

git('add', TAURI_CONF, PACKAGE, LOCK)
git('commit', '--quiet', '-m', `${key}: Version ${version}`)
console.log(`version: ${current} -> ${version}, committed on ${branch}; pushing`)
git('push', '--quiet', '-u', 'origin', 'HEAD')
console.log(`version: pushed ${branch}; ${tag} is released once it reaches main`)
