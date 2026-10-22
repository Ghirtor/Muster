---
name: app-verify
description: >
  Use when a change on this repo has passed its tests and needs checking in the running
  supervisor, CLI or dashboard before it is pushed — triggers on "check it in the app",
  "verify this works for real", or as the verification step of `implement-change`.
---

# App verify — check the change in the real app

Passing tests are not a working feature: the suites stub processes, ports and the API
boundary, so they never launch a real rig. Check the change yourself in the running app.

## Inputs

- **What to check** — the acceptance criteria and decisions in the branch's work log
  (`.claude/worklog/<branch-name>.md`, laid out as `.claude/skills/implement-change/worklog.md`
  describes), or the change the user describes.

## Verify

Start Flotilla from the branch's checkout with `npm run dev` (supervisor on `:4871`, dashboard
on `http://localhost:4870`; `.claude/launch.json` has the same entries for the browser pane).
Then exercise the change where it lives:

- **Engine or CLI** — run the CLI against `design/sample.yaml` and check its output and exit code
  (3 = busy) against `rig.mjs`'s for the same scenario.
- **API** — call the HTTP endpoints and open the WebSocket streams directly.
- **Dashboard** — drive it in the browser pane and compare it with the matching screen in
  `design/`.

Challenge it with the scenarios the feature can meet — a busy lock, a queued checkout, a
process that exits, a port that never opens — and check what actually landed: the lock file,
the per-process log, the processes and ports left behind, not just what the UI said. Stop every
process you started before you finish, including before fixing a finding, and never bind a
port the Demo rig uses.

If a scenario needs something this machine cannot stand in for, say so and say what you
exercised instead. Never skip this silently. Anything it turns up is fixed through
`tdd-implement` before the branch is pushed, not filed as a follow-up.

Log each scenario and what landed, and anything you could not exercise, under
**App verification**. For a visual change, save a screenshot of the result under
`.claude/worklog/<branch-name>/` and log its path with the scenario: it is the change request's evidence.
