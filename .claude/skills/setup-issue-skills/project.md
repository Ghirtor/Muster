# Project doc: template

Write `docs/agents/project.md` from this. Each bold item is a section a skill names; replace its
description with what is true of this project.

```markdown
# Project: <name>

How this repo installs, checks, commits and runs. Issues are the tracker's business
(`docs/agents/issue-tracker.md`); change requests and CI are the code host's
(`docs/agents/code-host.md`).

This file is the only place the skills learn what is particular to this project. The skills name
its sections (**Checks**, **Run the app**, ...) and do what the matching section says, so reusing
them in another project means writing this file for it, not changing the skills.

## Branches and commits

- **Protected branches** — the branches no skill works on.
- **Install a checkout** — the commands that make a fresh worktree ready to build and test, run
  from its root, and whether they also wire the git hooks.
- **Commit messages** — the format, normally `<ISSUE_KEY>: <summary>`, and the hook that
  enforces it.

## Code

- **Test rules** — the test frameworks, where the suites live, and the rule files they follow.
- **Untestable changes** — the kinds of change no suite can observe here (pure styling, config,
  hardware, OS behaviour).
- **Code conventions** — the convention files and the files they cover; what to do when a
  change would grow a shared component; what review weighs first because the linter cannot
  catch it.
- **Checks** — the commands to run before calling a change done, and a table mapping each CI
  job to the local command that reproduces it.

## Running it

- **Run the app** — why the suites do not stand in for it (what they stub), then:
  - _Start_: how to start the app from the branch's checkout, and the skills that drive it.
  - _Exercise the change where it lives_: per layer (CLI, API, UI, ...), how to reach it.
  - _Scenarios_: the ones this app is prone to.
  - _What landed_: where to look besides the UI (files, logs, processes, notifications).
  - _Stop_: what to stop or release when done, and ports or resources never to touch.
  - _Limits_: what the machine cannot stand in for (real hardware, another OS).
- **Test-plan edge cases** — the border cases particular to this project, on top of the usual
  empty values, bounds and error states.
- **Parallel sessions** — what several ticket sessions on one machine must share or take turns
  on (ports, a lock), and how.
```
