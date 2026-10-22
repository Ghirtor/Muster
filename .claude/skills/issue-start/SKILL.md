---
name: issue-start
description: >
  Use when starting work on a tracked issue on this repo — fetching the triaged ticket, marking
  it started, cutting its feature branch in a worktree of its own and agreeing its test seams
  with the user. Refuses issues that are not `ready-for-agent`. Triggers on "start this issue",
  "create the branch for this ticket", or as the first step of `/issue-work`.
---

# Issue start — fetch the issue and cut its branch

Fetch the issue and check it has been triaged `ready-for-agent`, mark it started, cut the
branch, open the branch's work log (`.claude/skills/implement-change/worklog.md`) from the
issue's Agent Brief, then agree the test seams with the user.

A **bold** name after "the project doc's", "the tracker doc's" or "the code-host doc's" is a
section of `docs/agents/project.md`, `docs/agents/issue-tracker.md` or `docs/agents/code-host.md`.

The ticket's open questions were settled at triage, by `/mattpocock-skills:triage`, which
grills the ticket into shape and posts an **Agent Brief** comment: category, current and
desired behaviour, key interfaces, acceptance criteria, out of scope. This skill builds on
that brief instead of grilling the ticket again.

## Inputs

- **`ISSUE`** — the issue, as its key or its reference (the tracker doc's **Identifiers**). Work
  out both; the rest of the flow uses **`ISSUE_KEY`** for commits and branches.
- **`SOURCE_BRANCH`** — the branch to create the new branch from, usually one of the code-host
  doc's **Default branches**. If it was not given, ask the user before continuing.

## Step 1 — Fetch the issue

The tracker doc's **Fetch an issue**, comments included.

## Step 2 — Check it is ready for an agent

Check the tracker doc's **Is it ready for an agent?**. If it is not, stop here: change nothing
on the issue or in git. Tell the user what is missing — the triage label or the Agent Brief —
and the issue's current triage label, if any (`needs-info` means it is waiting on its reporter,
`ready-for-human` that triage judged it should not be delegated), and suggest they triage it
first with:

```
/mattpocock-skills:triage <ISSUE>
```

Triage is user-invoked only, so do not try to run it yourself.

Otherwise take the brief's **Category** as the kind of change: `bug` is a **bug fix**,
`enhancement` a **feature / task**. Then the tracker doc's **Mark started**.

## Step 3 — Create the branch in its own worktree

Name it by the tracker doc's **Branch name** rule. Cut it into its own worktree, leaving the
main checkout untouched, then do the project doc's **Install a checkout** in it. If the worktree
already exists, the ticket was started before: reuse it.

```
git fetch origin
git worktree add -b <branch-name> .claude/worktrees/<branch-name> origin/<source-branch>
```

From here on **the worktree is the ticket's checkout**: every edit, build, test and git
command runs there. The session stays in the main checkout, where `.claude/` lives.

## Step 4 — Open the work log

Create `.claude/worklog/<branch-name>.md` in the main checkout as `worklog.md` describes, with
the worktree's path at its top. Fill its **Ticket** section from the Agent Brief: the issue key,
its reference when that differs, its title, bug fix or feature, `SOURCE_BRANCH`, the brief's
acceptance criteria one per line, and its out-of-scope items marked as such. Log each choice the
brief records (a desired behaviour picked over another, an edge case settled) under
**Decisions** with source `ticket comment`.

## Step 5 — Check the brief against the code and agree the seams

This is the one stop before implementation: once it is done, `/issue-work` runs
unattended to the review checkpoint, so nothing the work needs from the user may stay open.

Read the code the brief's **Key interfaces** name. A brief can sit for weeks, so note where the
code no longer matches it: an interface renamed or gone, a current behaviour that has changed,
a criterion already met.

Then call the Skill tool with `mattpocock-skills:grilling` and grill the user on two things
only: each mismatch found above, and the **seams** `mattpocock-skills:tdd` will test at — the
public interface each behaviour is observed through, with a one-line note on what that seam
catches and what it misses. For a bug, one seam is where the regression test reproduces it.
Do not reopen what the brief settled; if a mismatch means the brief itself is wrong rather than
out of date, say so and suggest re-triaging instead of redesigning the ticket here.

Done when the frontier is empty and the user has confirmed every seam. Log each answer under
**Decisions** with source `user`, and add any criterion the answers settle to **Ticket**.
Log the agreed seams under **Seams**.
