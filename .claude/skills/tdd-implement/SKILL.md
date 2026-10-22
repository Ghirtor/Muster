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

A **bold** name after "the project doc's", "the tracker doc's" or "the code-host doc's" is a
section of `docs/agents/project.md`, `docs/agents/issue-tracker.md` or `docs/agents/code-host.md`.

## Inputs

- **What to build** — one of: the issue the branch is named after (its key is in the branch
  name, as the tracker doc's **Identifiers** says; read the **Ticket** section of the work log,
  and the tracker doc's **Fetch an issue** when you need more), a review finding from
  `branch-review`, or a change the user describes.

Work on the branch that is checked out. If it is one of the project doc's **Protected
branches**, stop and ask which branch to use.

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

Tests follow the project doc's **Test rules**. The only exemption is a change no suite can
observe, as the project doc's **Untestable changes** describes it. Log every exemption, and
what covers it instead, under **TDD exemptions**.

## Bugs

**REQUIRED SUB-SKILL:** `mattpocock-skills:diagnosing-bugs`, before any fix. Its red-capable
feedback loop and ranked hypotheses find the root cause; its Phase 5 regression test is the
first red above. When no test seam reaches the bug, the running app (the project doc's **Run
the app**) is the feedback loop. State the hypothesis that proved right in the fix's commit
message.

## Conventions

A change follows the project doc's **Code conventions** — required, not advisory. Read them
before writing code in the files they cover, and write new code to them. Breaches in code the
loop leaves behind are `branch-review`'s to find and fix.

## Commit and check

Commit as you go in the project doc's **Commit messages** format. `ISSUE_KEY` is the key in the
branch name (the tracker doc's **Identifiers**). If the branch has none, ask the user which key
to use before the first commit; never bypass a commit hook. Before you finish, run the project
doc's **Checks** and read their output.
