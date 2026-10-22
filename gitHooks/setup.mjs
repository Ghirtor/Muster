import { execFileSync } from 'child_process'
import { chmodSync, rmSync } from 'fs'
import { join, dirname, resolve, isAbsolute } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const hooks = ['pre-commit', 'post-commit', 'commit-msg']

const git = (...args) =>
  execFileSync('git', args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'ignore']
  })
    .toString()
    .trim()

let gitCommonDir
try {
  gitCommonDir = git('rev-parse', '--git-common-dir')
} catch {
  // Not a git checkout -- an exported tarball, or a CI stage without history.
  process.exit(0)
}

// Point git at the tracked hooks rather than copying them into .git/hooks.
// Edits then take effect on the next commit instead of the next npm install,
// and there is no second copy to drift. A relative path resolves against the
// working tree root, which a linked worktree has just as much as the main
// checkout -- copies never reached worktrees at all, because their .git is a
// file rather than a directory.
git('config', 'core.hooksPath', 'gitHooks')

// git silently skips a hook that is not executable.
hooks.forEach((hook) => {
  try {
    chmodSync(join(__dirname, hook), 0o755)
  } catch {}
})

// Remove copies an earlier install left behind. They are inert while
// core.hooksPath is set, and would otherwise come back to life -- at whatever
// version they were frozen at -- if anyone ever unset it.
const legacyHooks = join(
  isAbsolute(gitCommonDir) ? gitCommonDir : resolve(repoRoot, gitCommonDir),
  'hooks'
)
;['pre-commit', 'post-commit', 'commit-msg'].forEach((hook) => {
  rmSync(join(legacyHooks, hook), { force: true })
})
