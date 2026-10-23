# Muster

Launch, watch and hand over local app rigs. Muster is the generic form of Demo's
`rig-ctl`: an app is registered once on the machine and keeps its launch recipe in its checkout, and Muster starts its processes in order, probes their ports, repairs known install failures, holds the one-per-machine
lock and queue, streams logs, and shows all of it in a web dashboard.

## Run

```bash
npm install        # also points git at gitHooks/ (or: node gitHooks/setup.mjs)
npm run dev        # supervisor on :4871 + dashboard on http://localhost:4870
```

Ports 4870/4871 are deliberate: Demo's rig holds 5173 (Vite's default), 1232, 1234, 8765–8767 and 9222.

## CLI

`rig.mjs`'s commands, flags and exit codes (0 ok, 1 failed, 2 usage or bad config, 3 busy), for any
registered app. The app is `--app <id>`, else `MUSTER_APP`; `--repo` picks the checkout whose
recipe runs, else the registered one. An app is registered first, as the `muster` skill of
project-skills describes; agents run every app, Muster included, through that skill.

```bash
muster register demo.yaml                 # prints the id, or every problem (exit 2)
muster apps
muster status --app demo
muster up --app demo --reason "checking the draw tool" --wait
muster release --app demo
muster down --app demo --force
```

`muster` on PATH is the installed desktop app's CLI, and the one skills call. It runs the bundled
`server/cli.js` with the machine's `node`, and each platform puts it on PATH its own way; open a new
terminal afterwards:

- **Windows**: the installers ship `bin\muster.cmd` (and `bin/muster` for Git Bash) and add
  `bin` to PATH — the NSIS installer the user's, the MSI the machine's — removing it on uninstall.
- **macOS**: a `.dmg` has no install step, so the app menu has *Muster → Install Command Line
  Tool*, which links `/usr/local/bin/muster` after asking for an administrator's password, and
  *Uninstall Command Line Tool*, which removes that link.
- **Linux**: the `.deb` and `.rpm` link `/usr/bin/muster` on install and remove it on uninstall
  (the app itself is `muster-app` there). An AppImage installs nothing, so nothing is on PATH.

Working on Muster itself, run the checkout's CLI instead, which nothing puts on PATH:
`npm run muster -- status --app <id>`.

A registration may name `rig.mjs`'s lock file (`~/.rig-ctl/lock.json`), so the two take turns on
the same rig. Instance modes are `one-per-machine`, `one-per-checkout` and `up-to-n` (`max`); up to N
gives each instance a slot but not yet its own ports.

## API

The supervisor (`src/server/main.ts`, a NestJS app, port `MUSTER_PORT` or 4871, loopback only) serves every
app registered in `MUSTER_HOME` (else `~/.muster`), by the id it was registered as.

| Route                                          | What                                              |
| ---------------------------------------------- | ------------------------------------------------- |
| `GET /api/health`, `POST /api/reload`          | Alive; re-read the registrations and recipes      |
| `GET /api/apps`, `GET /api/apps/:id`           | Config and live snapshot (state, ports, lock)     |
| `POST /api/apps`                               | Register `{file, text?}` → 201 app; invalid is 422 |
| `GET`/`PUT /api/apps/:id/config`               | Recipe text `{text}` (the registration's when it pins the recipe); invalid is 422 |
| `POST /api/apps/:id/config/validate`           | Problems with `{text}`, nothing saved             |
| `GET /api/apps/:id/status`, `/lock`, `/queue`  | Snapshot, holders, waiters                        |
| `GET /api/apps/:id/logs/:key?bytes=`           | Tail of one process log                           |
| `POST /api/apps/:id/actions`                   | `{action: up\|down\|release, reason, wait, force}` → 202 job, 409 if one runs |
| `GET /api/jobs`, `GET`/`DELETE /api/jobs/:id`  | Jobs with their output; cancel one                |

An action runs as a `muster` CLI process, so the lock and queue see it exactly as they see an
agent. The WebSocket at `/api/ws` takes `{type: 'subscribe' | 'unsubscribe', topics}` with topics
`status` (a snapshot per app whenever it changes), `jobs` (job changes and output) and
`log:<app>:<key>` (the tail, then what is appended). Requests from another origin than the
dashboard's, or with a non-loopback `Host`, get 403. Health also gives the machine's `hostname`.

## Dashboard

`src/web/` rebuilds the four `design/` screens: Fleet (`#/`), an app's detail (`#/apps/:id`), its
config (`#/apps/:id/config`) and the launch-blocked dialog, offered when a launch finds the rig
held by another checkout (join the queue, or stop it and take it over). It talks to the API with
axios and RTK Query (`src/web/api/musterApi.ts`); the WebSocket topics keep the query caches
current, so nothing polls. The config page edits the recipe's YAML text and validates it on the supervisor;
its structured summary is read-only.

## Check

```bash
node --run lint        # oxlint, type-aware, house rules in oxlint-plugins/
npm run type-check     # tsgo, web and server separately
npm test               # vitest: web (jsdom) and server (node) projects
node --run format      # oxfmt; format:check to only report
npm run build          # dashboard into dist/web, supervisor into dist/server
```

## Desktop app

Muster also ships as a Tauri 2 desktop app (`src-tauri/`). Building it needs Rust
(`rustup`); running it needs Node ≥ 22 on PATH, which it uses to start the bundled supervisor.

```bash
npm run dev:desktop      # window over the dev servers, hot reload, DevTools Protocol on :4872
npm run package          # release exe in src-tauri/target/release
npm run bundle           # plus MSI / NSIS installers in src-tauri/target/release/bundle
```

## Workflow

The remote is GitHub and tickets are GitHub Issues (`gh auth login` once). Branches and commits
carry the issue as `FEAT-<n>`. CI is `.github/workflows/ci.yml`.

Features merge into `dev`; `main` holds releases. A release is a merge of `dev` into `main`:
`.github/workflows/release.yml` tags the merge commit `v` + the `version` in
`src-tauri/tauri.conf.json`, then builds the installers for Windows, macOS and Linux and attaches
them to the run as artifacts. A version already tagged fails the run, so set the next one first,
on whichever branch it should go with, from a clean working tree:

```bash
./version.sh 0.2.0 FEAT-12     # Windows: .\version.bat 0.2.0 FEAT-12
```

It sets the version in `tauri.conf.json`, `package.json` and `package-lock.json`, commits them on
the checked-out branch as `FEAT-12: Version 0.2.0` and pushes that branch (`scripts/version.mjs`).

Then merge `dev` into `main`, by pull request or `git merge` and push.

## Layout

| Path            | What                                                             |
| --------------- | ---------------------------------------------------------------- |
| `src/server/`   | The supervisor (Node + TS, run with SWC): engine, NestJS API, CLI |
| `src/web/`      | The dashboard (React 19, Vite, Tailwind 4, React Compiler)       |
| `design/`       | Screens (`*.dc.html`), tokens (`tokens.json`), a mockup config   |
| `src-tauri/`    | The desktop app (Tauri 2): window + supervisor process           |
| `docs/agents/`  | How the agent skills reach the issue tracker and the code host   |
| `gitHooks/`     | pre-commit (oxfmt), post-commit, commit-msg (issue key required) |
