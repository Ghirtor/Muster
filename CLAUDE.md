# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

**Flotilla** manages local app rigs: it launches an app's required processes in order, watches
them, repairs known install failures, enforces how many instances may run (one per machine through a
lock and queue, one per checkout, or up to N) and shows it all in a web dashboard. Agents and people
use the same engine through a CLI and an HTTP/WebSocket API.

It generalises Demo's `rig-ctl` skill. **`rig.mjs` is the behaviour to match**;
`design/sample.yaml` is that same rig written as Flotilla config, and the first app it must run.

## Stack and tooling

Mirrors Demo's `Frontend/` — same versions (the lockfile was seeded from it), same rules:

- **Web**: React 19 + React Compiler (`babel-plugin-react-compiler`), Vite 7, Tailwind CSS 4. API state
  is RTK Query over axios (`src/web/api/`), fed by the WebSocket; ask before adding another library.
- **Server**: Node ≥ 22 + TypeScript, run with `tsx`. Node built-ins only until a dependency earns
  its place; ask before adding a framework.
- **Tests**: Jest 30 + ts-jest (ESM) + Testing Library, two projects (`web` jsdom, `server` node).
- **Lint**: oxlint, type-aware, rule lists from the typescript-eslint and eslint-react presets, house
  rules in `oxlint-plugins/house.js` (module shape, colour tokens).
- **Desktop**: Tauri 2.11 (`src-tauri/`, same versions as Demo's), wrapping the
  dashboard and starting the supervisor.
- **Types**: tsgo (`typescript7`), web and server checked separately.
- **Format**: oxfmt (no semicolons, single quotes, 100 cols, sorted imports and Tailwind classes).
- **Git hooks** (`gitHooks/`, wired by `npm install`): pre-commit formats staged files; commit-msg
  requires `FEAT-<n>: <summary>` and notes when the key differs from the
  branch's. `npm install` wires them (`core.hooksPath`); in a clone made before `git init`, run
  `npm run hooks` once.

## Commands

```bash
npm run dev                         # supervisor :4871 + dashboard :4870
npm run flotilla -- status --config design/sample.yaml   # CLI: status|up|release|down, rig.mjs's flags
FLOTILLA_CONFIGS=a.yaml;b.yaml npm run dev             # apps the supervisor serves (README: API)
node --run lint
npm run type-check
npm test                            # --selectProjects web|server for one
node --run format                   # format:check to only report
npm run build                       # dashboard → dist/web, supervisor → dist/server
npm run dev:desktop                 # Tauri window over the dev servers (debug:tauri:cdp: CDP :4872)
npm run package                     # release exe, no installer (bundle: with installers)
```

The desktop app (`src-tauri/`, Tauri 2) needs Rust (`rustup`) to build and Node ≥ 22 on PATH to
run: the packaged app starts the bundled supervisor with the machine's `node`, and the supervisor
serves the built dashboard (`FLOTILLA_WEB_ROOT`) so page and API share one origin.

Run lint, type-check and the tests before calling any change done.

## Rules

- `.claude/rules/conventions.md` — components, hooks, props, comments (from Demo).
- `.claude/rules/testing.md` — unit vs integration suites, what may be mocked.
- Colours, radii, shadows and fonts come from `src/web/styles/semantic.css`, which mirrors
  `design/tokens.json`. Never a literal colour or a default Tailwind palette class: the linter
  refuses both. A token's `usage` note in `tokens.json` is the rule for its class.
- `src/web` never imports from `src/server` or `node:*` (linted): it talks to the API.
- Never bind a port the Demo rig uses: 1232, 1234, 5173, 8765, 8766, 8767, 9222. Tests listen on 0.
  Flotilla's own: 4870 dashboard, 4871 supervisor, 4872 the desktop app's CDP.
- Windows first: the user's machine is Windows. Follow `rig.mjs` on shells (`execSync` for quoted
  args), killing (port → PID → `taskkill /T /F`, then image names) and logs (shell-owned redirection,
  no `detached`). Keep macOS/Linux paths working.

## Agent skills

The remote is GitHub (`gh`), and tickets are GitHub Issues with the `FEAT-<n>` key. The skills
under `.claude/` (`/issue-work`, `/issue-batch` and the skills they run) are tracker- and
host-agnostic: they name operations and look them up in

- `docs/agents/issue-tracker.md` — fetching, labelling, starting and handing over issues;
- `docs/agents/code-host.md` — pushing, pull requests, evidence and CI;
- `docs/agents/triage-labels.md` — the triage label strings.

To move to another tracker or remote, rewrite those files, not the skills.

## Design

`design/` holds the four screens (`Main` = Fleet, `Rig` = app detail, `Config`, `Busy` = launch
blocked) as `.dc.html` files — static HTML with inline styles and sample data — and `tokens.json`.
Rebuild them as React components with Tailwind classes from the tokens; don't copy their inline
styles or sample numbers.

## Plan

Build in phases; finish and test one before starting the next.

1. **Engine + CLI** (`src/server/engine/`, `src/server/cli.ts`): load and validate config
   (`design/sample.yaml`), lock + queue, launch order with `after`, sequential build groups, port
   probes (`probe.ts` exists), slow start, repair-once-on-exit, readiness checks, stop by port tree
   then image name, per-process logs. CLI `flotilla status|up|release|down` with `rig.mjs`'s flags
   and exit codes (3 = busy), so the rig-ctl skill can switch to it unchanged.
2. **API**: HTTP for apps, instances, lock, queue, actions; WebSocket for status and log streams.
3. **Dashboard**: Fleet, App detail, Config editor, Launch-blocked dialog, per `design/`.
