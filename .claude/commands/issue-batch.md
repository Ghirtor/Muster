---
description: Start /issue-work in a new session for every issue assigned to the user that is triaged ready-for-agent and not started yet — one session and one worktree per ticket. Triggers on "work on all my tickets", "start my ready issues", "batch issue-work".
argument-hint: <SOURCE_BRANCH> [MAX]
---

# Issue batch — one `/issue-work` session per ready ticket

Arguments: **$ARGUMENTS** — `<SOURCE_BRANCH> [MAX]`. Ask for `SOURCE_BRANCH` if it is
missing; `MAX` caps the sessions started (default: all). Run from the main checkout. Operations
and rules named in **bold** come from `docs/agents/issue-tracker.md` (the tracker doc) and
`docs/agents/project.md` (the project doc).

1. **Find the tickets**: the tracker doc's **List my ready issues**.

2. **Skip the ones already started**: those for which the tracker doc's **Has it been
   started?** holds. Keep the first `MAX`; if none is left, say so and stop.

3. **Start one session per ticket** with `mcp__ccd_session__start_session`: `initiation`
   `"user_asked"`, `context` `"fresh"`, `use_worktree` `false`, `title` the issue key alone,
   `prompt` `/issue-work <ISSUE_KEY> <SOURCE_BRANCH>`. In `background`, say it is one of several
   parallel ticket sessions: it works only in its own worktree, follows the project doc's
   **Parallel sessions** (quote it), and retries a git command that fails on a `.lock` file.

4. **Report** the sessions started, linked, and the tickets skipped with why. Each session
   will stop once at its seam check and wait for the user.
