# Project: Flotilla

How this repo installs, checks, commits and runs. Issues are the tracker's business
(`docs/agents/issue-tracker.md`); change requests and CI are the code host's
(`docs/agents/code-host.md`).

This file is the only place the skills learn what is particular to this project. The skills name
its sections (**Checks**, **Run the app**, ...) and do what the matching section says, so reusing
them in another project means writing this file for it, not changing the skills.

## Branches and commits

- **Protected branches** — `dev` and `master`. No skill works on them: stop and ask which branch
  to use.
- **Install a checkout** — from the checkout's root, worktrees included:

  ```
  npm ci
  ```

  It also wires the git hooks (`core.hooksPath` = `gitHooks/`).

- **Commit messages** — `<ISSUE_KEY>: <summary>`, e.g. `FEAT-12: Queue a second checkout`. The
  `commit-msg` hook rejects anything else; never pass `--no-verify` to get past it.

## Code

- **Test rules** — `.claude/rules/testing.md`: Jest, in the `web` (jsdom, `src/web/`) or `server`
  (node, `src/server/`) project.
- **Untestable changes** — a change no Jest suite can observe: pure styling, config, or OS
  behaviour (Windows process trees, shells) no test can stand in for.
- **Code conventions** — `.claude/rules/conventions.md`, for every `.ts` or `.tsx` file under
  `src/`; it loads on its own once you touch one. When the next behaviour needs a mode flag on a
  shared component or would grow one past a single job, write it as its own hook or component.
  What the linter cannot catch, and so what review weighs first: a component doing more than one
  job, a mode flag or extra branch added to a shared component, the hooks → derived → handlers →
  render order, and comments that are not docstrings on a function.
- **Checks** — run them all before calling a change done:

  ```
  node --run lint && npm run type-check && npm test && node --run format:check
  ```

  Each CI job (the code-host doc's **CI**) reproduces locally with one command:

  | CI job       | Reproduce locally                                 |
  | ------------ | ------------------------------------------------- |
  | `lint`       | `node --run lint`, then `node --run format:check` |
  | `type-check` | `npm run type-check`                              |
  | `build`      | `npm run build`                                   |
  | `test`       | `npm test -- --ci --coverage`                     |

## Running it

- **Run the app** — the suites stub processes, ports and the API boundary, so they never launch
  a real rig.
  - _Start_: `npm run dev` from the branch's checkout — supervisor on `:4871`, dashboard on
    `http://localhost:4870`; `.claude/launch.json` has the same entries for the browser pane.
    `tauri-ctl` drives the desktop app.
  - _Exercise the change where it lives_: for the engine or CLI, run the CLI against
    `design/sample.yaml` and check its output and exit code (3 = busy) against
    `rig.mjs`'s for the same scenario; for the API, call the HTTP endpoints and open the
    WebSocket streams directly; for the dashboard, drive it in the browser pane and compare it
    with the matching screen in `design/`.
  - _Scenarios_: a busy lock, a queued checkout, a process that exits, a port that never opens.
  - _What landed_: the lock file, the per-process log, the processes and ports left behind.
  - _Stop_: every process you started. Never bind a port the Demo rig uses (1232, 1234, 5173,
    8765, 8766, 8767, 9222).
  - _Limits_: whatever this machine cannot stand in for, such as another OS's process tree.
- **Test-plan edge cases** — ports already taken, processes that exit, Windows paths,
  simultaneous launches.
- **Parallel sessions** — every session shares `:4870` and `:4871`, so stop the dev servers as
  soon as the app is verified.
