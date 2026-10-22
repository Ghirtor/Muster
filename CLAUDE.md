# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

**Muster** manages local app rigs: it launches an app's required processes in order, watches
them, repairs known install failures, enforces how many instances may run (one per machine through a
lock and queue, one per checkout, or up to N) and shows it all in a web dashboard. Agents and people
use the same engine through a CLI and an HTTP/WebSocket API.

It generalises Demo's `rig-ctl` skill. **`rig.mjs` is the behaviour to match**;
`design/sample.yaml` is that same rig written as Muster config, and the first app it must run.

## Stack and tooling

Mirrors Demo's `Frontend/` — same versions (the lockfile was seeded from it), same rules:

- **Web**: React 19 + React Compiler (`babel-plugin-react-compiler`), Vite 7, Tailwind CSS 4. API state
  is RTK Query over axios (`src/web/api/`), fed by the WebSocket; ask before adding another library.
- **Server**: Node ≥ 22 + TypeScript, compiled by SWC everywhere: `@swc-node/register` in
  development, `unplugin-swc` in the build and the tests. The API (`src/server/api/`) is NestJS 12
  on Express, its WebSocket a `@nestjs/platform-ws` gateway; the engine and the CLI stay Nest-free.
  SWC emits decorator metadata, so classes are injected by type; `@Inject(TOKEN)` only for a
  non-class token (`SUPERVISOR_OPTIONS`). A class in a decorated constructor is imported as a
  value, never `import type`. Ask before adding another dependency.
- **Tests**: Vitest + Testing Library, two projects in `vitest.config.ts`: `web` (jsdom) and
  `server` (node, SWC). `describe`, `it`, `expect` and `vi` are globals.
- **Lint**: oxlint, type-aware, rule lists from the typescript-eslint presets everywhere and the
  eslint-react one in `src/web` only, house rules in `oxlint-plugins/house.js` (module shape, colour
  tokens).
- **Desktop**: Tauri 2.11 (`src-tauri/`, same versions as Demo's), wrapping the
  dashboard and starting the supervisor.
- **Types**: tsgo (`typescript7`). Each package has its own `tsconfig.json`, which the editor, Vitest
  and oxlint pick up by nearness: `src/web` (DOM, JSX, Vite, no Node), `src/server` (Node and
  decorators, no DOM or JSX), and the root one for the tooling files beside it. All extend
  `tsconfig.base.json`; `npm run type-check` checks the three separately.
- **Format**: oxfmt (no semicolons, single quotes, 100 cols, sorted imports and Tailwind classes).
- **Git hooks** (`gitHooks/`, wired by `npm install`): pre-commit formats staged files; commit-msg
  requires `FEAT-<n>: <summary>` and notes when the key differs from the
  branch's. `npm install` wires them (`core.hooksPath`); in a clone made before `git init`, run
  `node gitHooks/setup.mjs` once.

## Commands

```bash
npm run dev                         # supervisor :4871 + dashboard :4870
npm run muster -- status --config design/sample.yaml   # this checkout's CLI: status|up|release|down
MUSTER_CONFIGS=a.yaml;b.yaml npm run dev             # apps the supervisor serves (README: API)
node --run lint
npm run type-check
npm test                            # --project web|server for one
node --run format                   # format:check to only report
npm run build                       # dashboard → dist/web, supervisor → dist/server
npm run dev:desktop                 # Tauri window over the dev servers, CDP on :4872
npm run package                     # release exe, no installer (bundle: with installers)
./version.sh 0.2.0 FEAT-12          # next version, committed and pushed on this branch (.\version.bat)
```

The desktop app (`src-tauri/`, Tauri 2) needs Rust (`rustup`) to build and Node ≥ 22 on PATH to
run: the packaged app starts the bundled supervisor with the machine's `node`, and the supervisor
serves the built dashboard (`MUSTER_WEB_ROOT`) so page and API share one origin.

`muster` on PATH belongs to the installed app only, a shim (`src-tauri/cli/`) over the bundled
`server/cli.js`: Windows' installers add its `bin` to PATH (`tauri.windows.conf.json`,
`src-tauri/windows/`), Linux's deb/rpm link `/usr/bin/muster` (`tauri.linux.conf.json`,
`src-tauri/linux/`), and on macOS the app menu's *Install Command Line Tool* links
`/usr/local/bin/muster` (`src-tauri/src/cli_tool.rs`). Development never links it; use
`npm run muster` from the checkout.

Run lint, type-check and the tests before calling any change done.

## Rules

- `.claude/rules/conventions.md` — components, hooks, props, comments (from Demo).
- `.claude/rules/testing.md` — unit vs integration suites, what may be mocked.
- Colours, radii, shadows and fonts come from `src/web/styles/semantic.css`, which mirrors
  `design/tokens.json`. Never a literal colour or a default Tailwind palette class: the linter
  refuses both. A token's `usage` note in `tokens.json` is the rule for its class.
- `src/web` never imports from `src/server` or `node:*` (linted): it talks to the API.
- Never bind a port the Demo rig uses: 1232, 1234, 5173, 8765, 8766, 8767, 9222. Tests listen on 0.
  Muster's own: 4870 dashboard, 4871 supervisor, 4872 the desktop app's CDP.
- Windows first: the user's machine is Windows. Follow `rig.mjs` on shells (`execSync` for quoted
  args), killing (port → PID → `taskkill /T /F`, then image names) and logs (shell-owned redirection,
  no `detached`). Keep macOS/Linux paths working.

## Agent skills

### Issue tracker

GitHub Issues through `gh`, keyed `FEAT-<n>`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label named after its role. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the root, created when first needed. See
`docs/agents/domain.md`.

### Code host

GitHub (`gh`): pull requests target `dev`, CI and releases. See `docs/agents/code-host.md`.

### Project

Protected branches, commit format, checks and how to run the app for a check. See
`docs/agents/project.md`.

The issue skills (`/issue-work`, `/issue-batch` and the skills they run) name operations in bold
and look them up in these files. To move to another tracker, host or project, rewrite the files,
not the skills; `/project-skills:setup-project-skills` writes them for a new repo.

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
   then image name, per-process logs. CLI `muster status|up|release|down` with `rig.mjs`'s flags
   and exit codes (3 = busy), so the rig-ctl skill can switch to it unchanged.
2. **API**: HTTP for apps, instances, lock, queue, actions; WebSocket for status and log streams.
3. **Dashboard**: Fleet, App detail, Config editor, Launch-blocked dialog, per `design/`.
