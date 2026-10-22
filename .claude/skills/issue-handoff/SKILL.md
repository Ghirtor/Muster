---
name: issue-handoff
description: >
  Use when a feature branch on this repo has been approved at `implement-change`'s review
  checkpoint and is ready to go to review — push it, write its test plan, open its pull request,
  watch CI, and mark the issue in review. Triggers on "ship this branch", "open the PR and move
  the ticket", or as the last step of `/issue-work`.
---

# Issue handoff — push, change request, CI, review

Tracker operations are done as `docs/agents/issue-tracker.md` describes them, and code-host
operations (push, change request, CI) as `docs/agents/code-host.md` does; this skill names them
in **bold** and never assumes which tracker or host that is.

## Inputs

- **The branch** — the one checked out. **`ISSUE_KEY`** is the key in its name (the tracker
  doc's **Identifiers**).
- **`TARGET_BRANCH`** — what the change request merges into. Take it from the work log's
  **Ticket** section (its source branch), else ask the user. For a branch stacked on another
  issue's branch, the code-host doc's **Stacked change request** says what to target instead.

The work log is `.claude/worklog/<branch-name>.md` (`.claude/skills/implement-change/worklog.md`
describes it). Without one there is no logged approval, so Step 1 sends you to the
checkpoint first.

## Step 1 — Push the approved branch

The user approves the branch at `implement-change`'s review checkpoint, which logs the
approved commit under **Checkpoint** in the work log. Push only that commit: compare it with
`git rev-parse HEAD`. If there is no approval logged, or HEAD has moved past it, do not
push — run `implement-change`'s checkpoint (its Step 3) first, and come back once approved.

Then **Push**.

## Step 2 — Write a test plan

Before opening the change request, write a **test plan** that covers what was implemented:

- For a **bug fix**: include the exact reproduction steps for the original bug (so the
  reviewer can confirm it no longer reproduces) plus any related edge cases that share the
  underlying root cause.
- For a **feature / task**: include the golden-path scenarios that satisfy the acceptance
  criteria, plus the obvious negative cases (invalid input, disabled state, permission
  boundary, etc.).
- **Always** include the **special / border cases** considered while implementing —
  empty values, zero, sign boundaries, min/max bounds, ports already taken, processes that
  exit, Windows paths, async/error states, simultaneous launches, anything that had to be
  reasoned about explicitly while writing the code. If a tricky case was handled in code, it
  goes in the test plan. The work log's **Decisions** and **App verification** sections are
  where to look for them.

Write it as a checklist, one item per scenario, so a non-author can execute each item without
reading the code. It goes on the issue in Step 5; the change request's description carries
evidence, not the plan.

## Step 3 — Open the change request

**REQUIRED SUB-SKILL:** Use `open-pr`.

## Step 4 — Watch CI through to a result

The push in Step 1 started CI. Do not move on to Step 5 while it is still running.

**REQUIRED SUB-SKILL:** Use `ci-watch` with `BRANCH` = the checked-out branch and
`TARGET_BRANCH` = the change request's target. It owns the waiting, the failure triage and the
pre-existing-failure check.

Two things it needs from this skill's context: any fix it commits uses the
`{ISSUE_KEY}: <summary>` message format, and CI's verdict — green, fixed-then-green, or a
stated reason it cannot be fixed here — goes into your report to the user.

## Step 5 — Mark the issue in review and post the test plan

Once the change request is open:

1. **Mark in review**.
2. **Post the test plan** — the same plan as Step 2, with the change request's URL.
