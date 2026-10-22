---
description: Take a triaged (ready-for-agent) issue from ticket to change request — branch, agree test seams, implement test-first, review, verify in the app, push, open a change request, and mark the issue in review. Refuses untriaged issues and points to /mattpocock-skills:triage. Triggers on "work on this issue", "implement this ticket", or any request that starts from an issue and expects a change request.
argument-hint: <ISSUE> <SOURCE_BRANCH>
---

# Issue work — from ticket to change request

Arguments: **$ARGUMENTS** — expected format `<ISSUE> <SOURCE_BRANCH>`.

- First argument → **`ISSUE`**, the issue as its key or reference (`docs/agents/issue-tracker.md`,
  **Identifiers**).
- Second argument → **`SOURCE_BRANCH`**, the branch to create the new branch from, usually one of
  the code-host doc's **Default branches** (`docs/agents/code-host.md`). If it is missing, ask
  the user which source branch to use.

Rename this session to the issue key (`mcp__ccd_session_mgmt__set_session_title`, `session_id`
`"self"`) unless it is titled so already. Then run three skills in order; they hand state to
each other through the branch's work log (`.claude/skills/implement-change/worklog.md`).

1. **`issue-start`** with `ISSUE` and `SOURCE_BRANCH`. If it refuses the issue, stop: the
   user triages it with `/mattpocock-skills:triage` and runs `/issue-work` again.
2. **`implement-change`** with `BASE` = `SOURCE_BRANCH`.
3. **`issue-handoff`** with `TARGET_BRANCH` = `SOURCE_BRANCH`.

There are two planned stops: `issue-start`'s seam check, before any code is written, and
`implement-change`'s review checkpoint, before anything leaves the machine. Between them run
without stopping, apart from questions a skill says to ask. Once CI is green, suggest the user
run `/mattpocock-skills:retro` — it is user-invoked only.
