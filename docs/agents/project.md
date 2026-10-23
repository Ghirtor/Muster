# Project: Muster

## Issues

- **Issue key** — `FEAT-<n>`, where `<n>` is the GitHub issue number (`#12` is `FEAT-12`).
- **Branch name** — `FEAT-<n>/<Title_words>`: the key, a slash, then 6–8 words of the title in
  ASCII letters, digits and underscores, e.g. `FEAT-12/Lock_queue_for_one_per_machine_rigs`.
  Paths named after a branch nest under a `FEAT-<n>/` folder: `mkdir -p` it first.
- **Issue states** — the Status field of the Muster board (project 2, owner `Ghirtor`): `Ready`,
  `In progress`, `In review`, `Done`.

  ```
  gh project item-add 2 --owner Ghirtor --url <issue-url>
  gh project item-edit 2 --owner Ghirtor --url <issue-url> --field Status --value "In progress"
  ```

  Started: `In progress`, assigned with `gh issue edit <n> --add-assignee @me`. In review:
  `In review`. Ready issues by urgency: the board's Priority, `P0` first, then oldest
  (`gh project item-list 2 --owner Ghirtor --format json`).
- **Link an issue from a change request** — `Closes #<n>` in the PR body.

## Code host

- **Change requests** — GitHub pull requests, through `gh`. Find a branch's:
  `gh pr list --head <branch> --json number,url,baseRefName`. Open one:
  `gh pr create --head <branch> --base <target> --title "FEAT-<n>: <title>" --body-file <file> --assignee @me`;
  it prints the URL. No reviewers yet.
- **Default branches** — `dev`: every feature targets it. `main` takes only merges of `dev`;
  each push to `main` releases (`.github/workflows/release.yml`).
- **Stacked change request** — `--base <parent-branch>`; GitHub retargets it once the parent
  merges. Write `Depends on #<n>` in the description.
- **Attach evidence** — `gh` cannot upload images: commit them to the orphan `evidence` branch
  (not created yet: `git worktree add --orphan -b evidence <dir>`) under `<branch>/` and link `https://github.com/Ghirtor/Muster/blob/evidence/<branch>/<file>?raw=true`.

## CI

- **CI** — GitHub Actions, `.github/workflows/ci.yml`, on pushes to `dev` and `main` and on
  every pull request. `windows-latest`, except `linear-history` (ubuntu, pull requests only).

  | Job              | Locally                                                  |
  | ---------------- | -------------------------------------------------------- |
  | `linear-history` | `git rev-list --merges origin/<target>..HEAD` is empty   |
  | `lint`           | `node --run lint && node --run format:check`             |
  | `type-check`     | `npm run type-check`                                     |
  | `test`           | `npm test -- --coverage`                                 |
  | `build`          | `npm run build`                                          |

  Run for a push: `gh run list --branch <branch> --limit 1 --json databaseId,headSha,status`.
  Wait: `gh run watch <run-id> --exit-status`, in the background (3–8 min). Failed log:
  `gh run view <run-id> --log-failed`. Target's result: `gh run list --branch <target> --limit 1`.
  Re-run: `gh run rerun <run-id> --failed`.

## Branches and commits

- **Install a checkout** — `npm ci`; its `preinstall` wires `gitHooks/`.
- **Commit messages** — `FEAT-<n>: <summary>`, enforced by `gitHooks/commit-msg`.

## Running it

- **Run the app** — the suites stub processes, ports and the API.
  - _Start_: Muster id `muster` (recipe `muster.yaml`): supervisor on `:4871`, dashboard on
    `http://localhost:4870`. The desktop shell: `npm run dev:desktop`, after releasing `muster`
    (same ports).
  - _Drive the UI_: the dashboard at `http://localhost:4870/` in a browser; the desktop app is
    Tauri, CDP on `http://localhost:4872`, target `http://localhost:4870/`. Status streams over a
    WebSocket, so refs go stale fast.
  - _Scenarios_: a busy lock, a queued checkout, a process that exits, a port that never opens,
    Windows paths, simultaneous launches.
  - _What landed_: the lock file, the per-process logs, the processes and ports left behind. For
    the CLI, `npm run muster -- …` with its own `MUSTER_HOME`; exit code 3 means busy.
  - _Limits_: another OS's process tree. Never bind the Demo rig's ports (1232, 1234, 5173,
    8765–8767, 9222).
  - _Instances_: one per machine (`:4870`, `:4871`); `--wait` queues.

Open PR #3 (FEAT-2) moves the issue workflow onto the board and adds a `release-version` job.
