---
name: tdd-implement
description: >
  Use when writing or changing code for a feature or bug fix on this repo's feature branch —
  a ticket's implementation, a fix for a review finding, or a change the user describes.
  Enforces test-first development and keeps the branch's decision log. Triggers on
  "implement this", "fix this bug", or as the implementation step of `implement-change`.
---

# TDD implement — implement test-first on the current branch

Read the code the change touches first; for a bug, diagnose it first (see **Bugs**).

## Inputs

- **What to build** — one of: the issue the branch is named after (its key is in the branch
  name, as `docs/agents/issue-tracker.md`'s **Identifiers** says; read the **Ticket** section of the work log, and fetch the
  issue as `docs/agents/issue-tracker.md` describes when you need more), a review finding from
  `branch-review`, or a change the user describes.

Work on the branch that is checked out. If it is `main`, stop and ask
which branch to use.

The work log is `.claude/worklog/<branch-name>.md`, laid out as
`.claude/skills/implement-change/worklog.md` describes. Create it if it is missing. Log each
choice the ticket does not settle under **Decisions** as you make it.

## Test-first

**REQUIRED SUB-SKILL:** `mattpocock-skills:tdd`, red → green, one vertical slice at a time at
the seams logged under **Seams** — for a bug, the first red is the test that reproduces it.
Production code written before its failing test is deleted and redone test-first.

A behaviour no agreed seam reaches goes to the user with a proposed seam before its test is
written; log the answer under **Seams**. Refactoring sits outside the loop: `branch-review`
does it, on what its Standards review names.

Tests follow `.claude/rules/testing.md`, in the `web` (jsdom) or `server` (node) Jest project.
The only exemption is a change with no behaviour a Jest suite can observe — pure styling,
config, or OS behaviour (Windows process trees, shells) no test can stand in for. Log every exemption, and what covers it instead, under **TDD exemptions**.

## Bugs

**REQUIRED SUB-SKILL:** `mattpocock-skills:diagnosing-bugs`, before any fix. Its red-capable
feedback loop and ranked hypotheses find the root cause; its Phase 5 regression test is the
first red above. When no Jest seam reaches the bug, the running app
(`app-verify`) is the feedback loop. State the hypothesis that proved right in the
fix's commit message.

## Conventions

A change follows `.claude/rules/conventions.md` — required, not advisory. It
loads on its own once you touch a `.ts` or `.tsx` file under `src/`; read it then, and
write new code to it: when the next behaviour needs a mode flag on a shared component or would
grow one past a single job, write it as its own hook or component. Breaches in code the loop
leaves behind are `branch-review`'s to find and fix.

## Commit and check

Commit as you go with the `{ISSUE_KEY}: <summary>` message format — the `commit-msg` hook
rejects anything else. `ISSUE_KEY` is the key in the branch name (the tracker doc's
**Identifiers**). If the branch has
none, ask the user which key to use before the first commit; never bypass the hook. Before
you finish, run and read the output of everything the change touches:

```
node --run lint && npm run type-check && npm test && node --run format:check
```
