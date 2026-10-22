---
name: app-verify
description: >
  Use when a change on this repo has passed its tests and needs checking in the running app
  before it is pushed — triggers on "check it in the app", "verify this works for real", or as
  the verification step of `implement-change`.
---

# App verify — check the change in the real app

Passing tests are not a working feature: the suites stub their boundaries, so they never run
the real thing. Check the change yourself in the running app.

A **bold** name after "the project doc's", "the tracker doc's" or "the code-host doc's" is a
section of `docs/agents/project.md`, `docs/agents/issue-tracker.md` or `docs/agents/code-host.md`.

## Inputs

- **What to check** — the acceptance criteria and decisions in the branch's work log
  (`.claude/worklog/<branch-name>.md`, laid out as `.claude/skills/implement-change/worklog.md`
  describes), or the change the user describes.

## Verify

Run the app from the branch's checkout as the project doc's **Run the app** says, and exercise
the change where it lives. Challenge it with the scenarios the feature can meet, starting with
the ones that section lists, and check what actually landed where it says to look, not just
what the UI said. Stop or release what you started as soon as the scenarios are done,
including before fixing a finding.

If a scenario needs something the machine cannot stand in for (the section's limits), say so
and say what you exercised instead. Never skip this silently. Anything it turns up is fixed
through `tdd-implement` before the branch is pushed, not filed as a follow-up.

Log each scenario and what landed, and anything you could not exercise, under
**App verification**. For a visual change, save a screenshot of the result under
`.claude/worklog/<branch-name>/` and log its path with the scenario: it is the change request's
evidence.
