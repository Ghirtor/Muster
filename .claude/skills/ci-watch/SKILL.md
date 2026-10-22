---
name: ci-watch
description: >
  Use when a branch has just been pushed or a change request opened on this repo and its CI
  result is not known yet, or when CI or one of its jobs has gone red — triggers on "check CI",
  "is CI green", "the PR is failing", "the MR is failing", "check the pipeline", "why did this
  job fail", or CI still running at the end of a task.
---

# CI watch — take CI to a known result

**Report a CI result, never CI in flight.** A pushed branch whose CI is still running is
unfinished work: the point of CI is the verdict, and a task that ends at "running" has skipped
it.

A **bold** name after "the project doc's", "the tracker doc's" or "the code-host doc's" is a
section of `docs/agents/project.md`, `docs/agents/issue-tracker.md` or `docs/agents/code-host.md`.

Green locally does not mean green in CI. CI runs on fresh runners (the code-host doc's **CI**
says which) that install from the lockfile and run the tests with coverage, so path casing,
line endings, lockfile drift and coverage thresholds can all fail there while passing locally.

## Inputs

- **`BRANCH`** — the pushed branch to watch.
- **`TARGET_BRANCH`** — what its change request merges into: one of the code-host doc's
  **Default branches**, or the parent's branch for a stacked one. Needed to tell your failures
  apart from pre-existing ones.

## Watch

The code-host doc's **Find the run for a push**, then the code-host doc's **Watch CI** in the
background, and wait for it to finish rather than polling with a bare foreground `sleep`, which
the harness may block. On success, report green; on failure, the code-host doc's **Read a failed
job's log**, and follow **Fix only what you broke**.

## Reproduce locally

Reproduce the failed job before changing anything, with the command the project doc's
**Checks** maps it to. Run it unpiped and read the real output. Piping masks the exit code —
`<check> 2>&1 | tail -3 && echo OK` prints `OK` even when the check fails, because the status is
`tail`'s.

If it does not reproduce locally, suspect the runner differences above before concluding CI is
flaky; the code-host doc's **Re-run the failed jobs** only for a failure that is not in the code.

## Fix only what you broke

Run the failed job's command against `TARGET_BRANCH` — or read the code-host doc's **The target
branch's latest result** — before touching anything. A job that already fails there is
pre-existing: say so plainly, leave it alone, and finish. Do not widen the current task's scope
to fix unrelated red jobs, and do not stage files the task never touched.

If the failure _is_ yours: fix it, commit in the project doc's **Commit messages** format, do the
code-host doc's **Push**, and watch the new run the same way. Repeat until green, or until you
have a specific reason the failure cannot be fixed here — then tell the user that reason instead
of leaving the branch silently red.
