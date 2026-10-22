# Muster

Launch, watch and hand over local app rigs. Muster is the generic form of Demo's
`rig-ctl`: an app is described once in a config (`design/sample.yaml` for Demo), and Muster starts
its processes in order, probes their ports, repairs known install failures, holds the one-per-machine
lock and queue, streams logs, and shows all of it in a web dashboard.

## Run

```bash
npm install        # also points git at gitHooks/ (or: node gitHooks/setup.mjs)
npm run dev        # supervisor on :4871 + dashboard on http://localhost:4870
```

Ports 4870/4871 are deliberate: Demo's rig holds 5173 (Vite's default), 1232, 1234, 8765–8767 and 9222.

## CLI

`rig.mjs`'s commands, flags and exit codes (0 ok, 1 failed, 2 usage or bad config, 3 busy), for any
app's config. The config is `--config`, else `MUSTER_CONFIG`, else `./muster.yaml`; `--repo`
overrides the checkout the config names.

```bash
muster status --config design/sample.yaml
muster up --config design/sample.yaml --reason "checking the draw tool" --wait
muster release --config design/sample.yaml
muster down --config design/sample.yaml --force
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
`npm run muster -- status --config design/sample.yaml`.

`design/sample.yaml` uses `rig.mjs`'s lock file (`~/.rig-ctl/lock.json`), so the two take turns on the
same rig. Instance modes are `one-per-machine`, `one-per-checkout` and `up-to-n` (`max`); up to N
gives each instance a slot but not yet its own ports.

## API

The supervisor (`src/server/main.ts`, a NestJS app, port `MUSTER_PORT` or 4871, loopback only) serves every
config in `MUSTER_CONFIGS` (paths joined by `;` on Windows, `:` elsewhere), else whichever of
`./muster.yaml` and `design/sample.yaml` exist. Each app's id is its name as a slug.

| Route                                          | What                                              |
| ---------------------------------------------- | ------------------------------------------------- |
| `GET /api/health`, `POST /api/reload`          | Alive; re-read the configs                        |
| `GET /api/apps`, `GET /api/apps/:id`           | Config and live snapshot (state, ports, lock)     |
| `GET`/`PUT /api/apps/:id/config`               | Config text `{text}`; an invalid one is 422       |
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
current, so nothing polls. The config page edits the YAML text and validates it on the supervisor;
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
| `design/`       | Screens (`*.dc.html`), tokens (`tokens.json`), Demo's config     |
| `src-tauri/`    | The desktop app (Tauri 2): window + supervisor process           |
| `docs/agents/`  | How the agent skills reach the issue tracker and the code host   |
| `gitHooks/`     | pre-commit (oxfmt), post-commit, commit-msg (issue key required) |
