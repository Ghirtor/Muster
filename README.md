# Flotilla

Launch, watch and hand over local app rigs. Flotilla is the generic form of Demo's
`rig-ctl`: an app is described once in a config (`design/sample.yaml` for Demo), and Flotilla starts
its processes in order, probes their ports, repairs known install failures, holds the one-per-machine
lock and queue, streams logs, and shows all of it in a web dashboard.

## Run

```bash
npm install        # also points git at gitHooks/ (or: npm run hooks)
npm run dev        # supervisor on :4871 + dashboard on http://localhost:4870
```

Ports 4870/4871 are deliberate: Demo's rig holds 5173 (Vite's default), 1232, 1234, 8765–8767 and 9222.

## CLI

`rig.mjs`'s commands, flags and exit codes (0 ok, 1 failed, 2 usage or bad config, 3 busy), for any
app's config. The config is `--config`, else `FLOTILLA_CONFIG`, else `./flotilla.yaml`; `--repo`
overrides the checkout the config names.

```bash
npm run flotilla -- status --config design/sample.yaml
npm run flotilla -- up --config design/sample.yaml --reason "checking the draw tool" --wait
npm run flotilla -- release --config design/sample.yaml
npm run flotilla -- down --config design/sample.yaml --force
```

`design/sample.yaml` uses `rig.mjs`'s lock file (`~/.rig-ctl/lock.json`), so the two take turns on the
same rig. Instance modes are `one-per-machine`, `one-per-checkout` and `up-to-n` (`max`); up to N
gives each instance a slot but not yet its own ports.

## API

The supervisor (`src/server/main.ts`, a NestJS app, port `FLOTILLA_PORT` or 4871, loopback only) serves every
config in `FLOTILLA_CONFIGS` (paths joined by `;` on Windows, `:` elsewhere), else whichever of
`./flotilla.yaml` and `design/sample.yaml` exist. Each app's id is its name as a slug.

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

An action runs as a `flotilla` CLI process, so the lock and queue see it exactly as they see an
agent. The WebSocket at `/api/ws` takes `{type: 'subscribe' | 'unsubscribe', topics}` with topics
`status` (a snapshot per app whenever it changes), `jobs` (job changes and output) and
`log:<app>:<key>` (the tail, then what is appended). Requests from another origin than the
dashboard's, or with a non-loopback `Host`, get 403. Health also gives the machine's `hostname`.

## Dashboard

`src/web/` rebuilds the four `design/` screens: Fleet (`#/`), an app's detail (`#/apps/:id`), its
config (`#/apps/:id/config`) and the launch-blocked dialog, offered when a launch finds the rig
held by another checkout (join the queue, or stop it and take it over). It talks to the API with
axios and RTK Query (`src/web/api/flotillaApi.ts`); the WebSocket topics keep the query caches
current, so nothing polls. The config page edits the YAML text and validates it on the supervisor;
its structured summary is read-only.

## Check

```bash
node --run lint        # oxlint, type-aware, house rules in oxlint-plugins/
npm run type-check     # tsgo, web and server separately
npm test               # jest: web (jsdom) and server (node) projects
node --run format      # oxfmt; format:check to only report
npm run build          # dashboard into dist/web, supervisor into dist/server
```

## Desktop app

Flotilla also ships as a Tauri 2 desktop app (`src-tauri/`). Building it needs Rust
(`rustup`); running it needs Node ≥ 22 on PATH, which it uses to start the bundled supervisor.

```bash
npm run dev:desktop      # window over the dev servers, with hot reload
npm run debug:tauri:cdp  # same, with Chrome DevTools Protocol on :4872
npm run package          # release exe in src-tauri/target/release
npm run bundle           # plus MSI / NSIS installers in src-tauri/target/release/bundle
```

## Workflow

The remote is GitHub and tickets are GitHub Issues (`gh auth login` once). Branches and commits
carry the issue as `FEAT-<n>`. CI is `.github/workflows/ci.yml`.

## Layout

| Path            | What                                                             |
| --------------- | ---------------------------------------------------------------- |
| `src/server/`   | The supervisor (Node + TS, run with tsx): engine, NestJS API, CLI |
| `src/web/`      | The dashboard (React 19, Vite, Tailwind 4, React Compiler)       |
| `design/`       | Screens (`*.dc.html`), tokens (`tokens.json`), Demo's config     |
| `reference/`    | `rig.mjs`, the behaviour the engine must match                   |
| `src-tauri/`    | The desktop app (Tauri 2): window + supervisor process           |
| `docs/agents/`  | How the agent skills reach the issue tracker and the code host   |
| `gitHooks/`     | pre-commit (oxfmt), post-commit, commit-msg (issue key required) |
