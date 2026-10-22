# Code host: GitHub

The repo's remote `origin` is on GitHub. Pull requests and CI go through the `gh` CLI; run
`gh auth status` first, and if it is not logged in, stop and ask the user to run `gh auth login`.
Never handle a token yourself. Issues are the tracker's business: `docs/agents/issue-tracker.md`.

This file is the only place the skills learn how the code host works. The skills name operations
(**Open a change request**, **Watch CI**, ...) and do what the matching section says, so moving to
another host means rewriting this file, not the skills.

## Identifiers

- **Change request** — a GitHub pull request, `#<n>`. Issues and PRs share one number space.
- **Default branches** — `dev`: every change request targets it. `master` takes only merges of
  `dev`, which release (see **CI**); never target it with a feature.
- **Reviewers** — none set yet. Add GitHub logins here (`--reviewer a,b`) once the team is on the
  repo; until then open PRs without reviewers and say so in the report.

## Change requests

- **History** — semi-linear. A feature branch carries no merge commits and reaches `dev` as one
  merge commit, once it is up to date with `dev`. GitHub only offers **Create a merge commit**.
- **Update a branch from its target**: rebase, never merge. Run `git fetch origin && git rebase
  origin/<target>`, then `git push --force-with-lease`. On GitHub, use **Update branch ▾ → Update
  with rebase**. `gitHooks/pre-merge-commit` refuses a merge commit on any branch but `dev` and
  `master`. Don't pass `--no-verify` to get past it: CI's `linear-history` job and the repo's
  ruleset refuse the branch anyway.
- **Push**: `git push -u origin HEAD`.
- **Find the change request for a branch**:
  `gh pr list --head <branch> --state open --json number,url,baseRefName`. Its `baseRefName` is
  the branch's target.
- **Open a change request**: write the description to a file first, then

  ```
  gh pr create --head <branch> --base <target> --title "<ISSUE_KEY>: <issue title>" \
    --body-file pr-body.md --assignee @me [--reviewer <Reviewers>]
  ```

  It prints the PR's URL; the tracker's **Post the test plan** needs it. Confirm what landed with
  `gh pr view <url> --json number,url,baseRefName,assignees,reviewRequests`.
- **Stacked change request** — a branch cut from another issue's branch: target the parent's
  branch (`--base <parent-branch>`), not `dev`. When the parent merges and its branch is deleted,
  GitHub retargets the child on its own. Name the parent PR (`Depends on #<n>`) under **Merge
  Danger** in the description.
- **Attach evidence** — `gh` cannot upload images to a PR, so screenshots go on the orphan
  `evidence` branch, one folder per branch, and the description links them:

  ```
  git fetch origin evidence || true
  git worktree add --orphan -b evidence ../flotilla-evidence   # first time; else: git worktree add ../flotilla-evidence evidence
  cp <screenshots> ../flotilla-evidence/<branch>/ && cd ../flotilla-evidence
  git add . && git commit -m "<ISSUE_KEY>: evidence" && git push origin evidence
  cd - && git worktree remove ../flotilla-evidence
  ```

  Link each as `![<scenario>](https://github.com/<owner>/<repo>/blob/evidence/<branch>/<file>?raw=true)`
  (`gh repo view --json nameWithOwner` gives `<owner>/<repo>`).
- **Comment on a change request**: `gh pr comment <n> --body-file <file>`.

## CI

CI is GitHub Actions, `.github/workflows/ci.yml`, on `windows-latest` runners. They `npm ci` from
the lockfile and run the jobs `lint` (lint + format check), `type-check`, `test` (with coverage)
and `build`. It runs on pushes to `dev` and `master` and on every pull request. Pull requests
also run `linear-history`, which fails if the branch has a merge commit that is not on its target.
The fix is to rebase (**Update a branch from its target**). It doesn't run for the `dev` → `master`
pull request. A separate
workflow, `.github/workflows/release.yml`, runs on each push to `master`: it tags the commit `v` +
`src-tauri/tauri.conf.json`'s `version` (set by `version.sh` / `version.bat` on the checked-out
branch; a version already tagged fails it), then builds the desktop installers on Windows, macOS
and Linux and keeps them as the run's artifacts (`gh run download <run-id>`).

- **Find the run for a push**:
  `gh run list --branch <branch> --limit 1 --json databaseId,headSha,status,conclusion`. Check its
  `headSha` is the pushed commit (`git rev-parse HEAD`); a run can take a few seconds to appear.
- **Watch CI**: `gh run watch <run-id> --exit-status` blocks until the run ends and exits non-zero
  on failure. Run it in the background; a full run takes about 3–8 minutes.
- **Read a failed job's log**: `gh run view <run-id> --log-failed`, or list the jobs with
  `gh run view <run-id> --json jobs --jq '.jobs[] | [.name, .conclusion] | @tsv'`.
- **The target branch's latest result**:
  `gh run list --branch <target> --limit 1 --json conclusion,headSha`.
- **Re-run the failed jobs**: `gh run rerun <run-id> --failed`. Use it only for a failure that
  is not in the code (a runner that died, a download that timed out).
