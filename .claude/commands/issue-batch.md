---
description: Start /issue-work in a new session for every issue assigned to the user that is triaged ready-for-agent and not started yet — one session and one worktree per ticket. Triggers on "work on all my tickets", "start my ready issues", "batch issue-work".
argument-hint: <SOURCE_BRANCH> [MAX]
---

# Issue batch — one `/issue-work` session per ready ticket

Arguments: **$ARGUMENTS** — `<SOURCE_BRANCH> [MAX]`. Ask for `SOURCE_BRANCH` if it is
missing; `MAX` caps the sessions started (default: all). Run from the main checkout. Tracker
operations in **bold** are done as `docs/agents/issue-tracker.md` describes them.

1. **Find the tickets**: **List my ready issues**.

2. **Skip the ones already started**: **Has it been started?**, or a work log
   `.claude/worklog/<ISSUE_KEY>/*.md` or worktree `.claude/worktrees/<ISSUE_KEY>/*` exists.
   Keep the first `MAX`; if none is left, say so and stop.

3. **Start one session per ticket** with `mcp__ccd_session__start_session`: `initiation`
   `"user_asked"`, `context` `"fresh"`, `use_worktree` `false`, `title` the issue key alone,
   `prompt` `/issue-work <ISSUE_KEY> <SOURCE_BRANCH>`. In `background`, say it is one of several
   parallel ticket sessions: it works only in its own worktree, stops the dev servers as soon as it
   has verified (every session shares :4870 and :4871), and retries a git command that fails on a
   `.lock` file.

4. **Report** the sessions started, linked, and the tickets skipped with why. Each session
   will stop once at its seam check and wait for the user.
