---
name: ci-watch
description: >
  Use when a branch has just been pushed or a change request opened on this repo and its CI
  result is not known yet, or when CI or one of its jobs has gone red — triggers on "check CI",
  "is CI green", "the PR is failing", "check the pipeline", "why did lint / type-check / test /
  build fail", or CI still running at the end of a task.
---

# CI watch — take CI to a known result

**Report a CI result, never CI in flight.** A pushed branch whose CI is still running is
unfinished work: the point of CI is the verdict, and a task that ends at "running" has skipped
it.

The code-host operations named in **bold** are done as `docs/agents/code-host.md` describes
them; its **CI** section also says where CI runs and what its jobs are.

Green locally does not mean green in CI. CI runs on fresh runners that `npm ci` from the
lockfile and run the tests with coverage, so path casing, CRLF, lockfile drift and coverage
thresholds can all fail there while passing locally.

## Inputs

- **`BRANCH`** — the pushed branch to watch.
- **`TARGET_BRANCH`** — what its change request merges into (`dev`). Needed to tell your
  failures apart from pre-existing ones.

## Watch

**Find the run for a push**, then **Watch CI** in the background and wait for it to finish
rather than polling with a bare foreground `sleep`, which the harness may block. On success,
report green; on failure, **Read a failed job's log** and follow **Fix only what you broke**.

## Reproduce locally

Reproduce the failed job before changing anything — each maps to one command:

| CI job       | Reproduce locally                                 |
| ------------ | ------------------------------------------------- |
| `lint`       | `node --run lint`, then `node --run format:check` |
| `type-check` | `npm run type-check`                              |
| `build`      | `npm run build`                                   |
| `test`       | `npm test -- --ci --coverage`                     |

Run these unpiped and read the real output. Piping masks the exit code —
`node --run lint 2>&1 | tail -3 && echo OK` prints `OK` even when oxlint reports errors,
because the status is `tail`'s.

If it does not reproduce locally, suspect the runner differences above before concluding CI is
flaky; **Re-run the failed jobs** only for a failure that is not in the code.

## Fix only what you broke

Run the failed job's command against `TARGET_BRANCH` — or read **The target branch's latest
result** — before touching anything. A job that already fails there is pre-existing: say so
plainly, leave it alone, and finish. Do not widen the current task's scope to fix unrelated red
jobs, and do not stage files the task never touched.

If the failure *is* yours: fix it, commit (respecting the repo's commit-message format),
**Push**, and watch the new run the same way. Repeat until green, or until you have a specific
reason the failure cannot be fixed here — then tell the user that reason instead of leaving the
branch silently red.
