# Project: Muster

## Issues

- **Issue key** — `FEAT-<n>`, where `<n>` is the GitHub issue number (`#12` is `FEAT-12`).
- **Branch name** — `FEAT-<n>/<Title_words>`: the key, a slash, then 6–8 words of the title in
  ASCII letters, digits and underscores, e.g. `FEAT-12/Lock_queue_for_one_per_machine_rigs`.
  Paths named after a branch nest under a `FEAT-<n>/` folder: `mkdir -p` it first.
- **Issue states** — the Status of the issue's card on the Muster board
  (`https://github.com/users/Ghirtor/projects/2`), not a label: `Backlog` (untriaged or waiting
  on information), `Ready`, `In progress`, `In review`, `Done`. The board also has **Priority**
  (`P0` most urgent, then `P1`, `P2`) and **Size**. `gh` needs the `project` scope:
  `gh auth refresh -h github.com -s project`.
  - _IDs_: project `PVT_kwHOAiYoDc4BoS6g`; Status field `PVTSSF_lAHOAiYoDc4BoS6gzhmzrDQ`, options
    `Backlog` `f75ad846`, `Ready` `61e4505c`, `In progress` `47fc9ee4`, `In review` `df73e18b`,
    `Done` `98236657` (`gh project field-list 2 --owner Ghirtor --format json` re-reads them).
  - _Create on the board_: `gh issue create --project Muster ...` lands in `Backlog`. An existing
    issue: `gh project item-add 2 --owner Ghirtor --url <issue-url> --format json --jq .id`.
  - _Find a card_: read it through the issue, never `gh project item-list`, which lags minutes:
    `gh issue view <n> --json projectItems`, or for its id
    `gh api graphql -F n=<n> -f query='query($n: Int!) { repository(owner: "Ghirtor", name: "Muster") { issue(number: $n) { projectItems(first: 5) { nodes { id project { number } } } } } }' --jq '.data.repository.issue.projectItems.nodes[] | select(.project.number == 2) | .id'`.
  - _Set the status_:
    `gh project item-edit --id <card-id> --project-id PVT_kwHOAiYoDc4BoS6g --field-id PVTSSF_lAHOAiYoDc4BoS6gzhmzrDQ --single-select-option-id <option-id>`.
  - _Ready for an agent_: its card is `Ready`, a comment holds an `## Agent Brief` (the latest
    wins), and it is not labelled `ready-for-human`. Started: assign with
    `gh issue edit <n> --add-assignee @me`, then `In progress`. In review: `In review`. Closing
    the issue or merging its PR makes it `Done`.
  - _Ready issues by urgency_: `gh api graphql` search
    `repo:Ghirtor/Muster is:issue is:open project:Ghirtor/2`, reading each issue's
    `projectItems` Status and Priority; keep `Ready` cards assigned to me or no one, `P0` first,
    then oldest.
  - _Triage roles move the card_: `needs-triage` and `needs-info` → `Backlog`; `ready-for-agent`
    and `ready-for-human` → `Ready` (agents skip the latter); `wontfix` → `Done`, issue closed.
    Put the issue on the board first if it has no card.
- **Link an issue from a change request** — `Closes #<n>` in the PR body.

## Code host

- **Change requests** — GitHub pull requests, through `gh`. Find a branch's:
  `gh pr list --head <branch> --json number,url,baseRefName`. Open one:
  `gh pr create --head <branch> --base <target> --title "FEAT-<n>: <title>" --body-file <file> --assignee @me`;
  it prints the URL. No reviewers yet.
- **Default branches** — `dev`: every feature targets it. `main` takes only merges of `dev`;
  each push to `main` releases (`.github/workflows/release.yml`).
- **Update a branch from its target** — rebase, never merge: `git fetch origin && git rebase
  origin/<target>`, then `git push --force-with-lease`; on GitHub, **Update branch ▾ → Update with
  rebase**. The same for conflicts with `dev`, and for catching up with a feature branch this one
  already shares work with (one it merged before, or the one it was started from): rebase onto
  it. The one merge a feature branch may carry is a first-time merge of another feature branch;
  `gitHooks/pre-merge-commit` and CI's `linear-history` refuse the rest. Never pass
  `--no-verify` to get past the hook.
- **Stacked change request** — `--base <parent-branch>`; GitHub retargets it once the parent
  merges. Write `Depends on #<n>` in the description.
- **Attach evidence** — `gh` cannot upload images: commit them to the orphan `evidence` branch
  (not created yet: `git worktree add --orphan -b evidence <dir>`) under `<branch>/` and link `https://github.com/Ghirtor/Muster/blob/evidence/<branch>/<file>?raw=true`.

## CI

- **CI** — GitHub Actions, `.github/workflows/ci.yml`, on pushes to `dev` and `main` and on
  every pull request. `windows-latest`, except `linear-history` and `release-version` (ubuntu,
  pull requests only).

  | Job               | Locally                                                      |
  | ----------------- | ------------------------------------------------------------ |
  | `linear-history`  | `gitHooks/pre-merge-commit`, as you merge                    |
  | `lint`            | `node --run lint && node --run format:check`                 |
  | `type-check`      | `npm run type-check`                                         |
  | `test`            | `npm test -- --coverage`                                     |
  | `build`           | `npm run build`                                              |
  | `release-version` | `dev` → `main` only: `tauri.conf.json`'s version is untagged |

  Run for a push: `gh run list --branch <branch> --limit 1 --json databaseId,headSha,status`.
  Wait: `gh run watch <run-id> --exit-status`, in the background (3–8 min). Failed log:
  `gh run view <run-id> --log-failed`. Target's result: `gh run list --branch <target> --limit 1`.
  Re-run: `gh run rerun <run-id> --failed`. A failed `release-version` means `version.sh` /
  `version.bat` on `dev` with the next version; the PR picks it up.

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
