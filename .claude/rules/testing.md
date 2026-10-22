# Testing rules

Rules for writing, naming and running Vitest suites under `src/`. `vitest.config.ts` runs two
projects: `web` (jsdom, `src/web/`) and `server` (node, `src/server/`, compiled by SWC for Nest's
decorator metadata). Add `--project web` or `--project server` to run one. `describe`, `it`,
`expect` and `vi` are globals.

## Naming

Two kinds of suite live side by side, and the filename says which is which:

- **Unit** — `<Subject>.test.tsx`, colocated with `<Subject>.tsx`. Renders its own subject with
  the neighbours mocked.
- **Integration** — `<Flow>.integration.test.tsx`. Renders components it is **not** named after,
  because the subject is a composition rather than a module.

That is the whole test: *does this suite render something it is not named after?* Apply it
mechanically — left to taste the distinction drifts, since in React almost every component test
renders some children.

## Keep `.test.tsx` as the ending

`.integration.test.tsx` works because it still ends in `.test.tsx`. Two mechanisms depend on that:

- Each project in `vitest.config.ts` includes only `*.test.ts` and `*.test.tsx`.
- `coverage.exclude`'s `**/*.{test,spec}.{ts,tsx,js,jsx}` keeps test files from being measured as
  coverage targets. Coverage is a CI-tracked metric (`.github/workflows/ci.yml` runs
  `npm test -- --coverage` and keeps the report).

So do **not** name a suite `*.integration.tsx`, `*.itest.tsx`, or anything else that drops
`.test.` — Vitest will not run it *and* coverage will count it as uncovered source, dragging the
reported percentage down. Excluding test files from coverage is deliberate: they execute close to
100% by construction, so measuring them inflates the number and hides gaps in real source. An
integration suite still contributes its coverage to the source files it exercises.

## Running a single kind

```
npm test -- --exclude='**/*.integration.*'   # unit only — fast inner loop
npm test -- .integration.                    # integration only: a filter on the file path
```

Both run from the repo root. Split them into separate CI jobs only once the integration suites are
slow enough to be worth it.

## What an integration suite may mock

Mock only what jsdom or the bundler cannot provide, and say why in a comment on the mock:

- Heavy leaves with no bearing on the flow: charts, the log console's virtualised list.
- The API boundary — the dashboard's fetch/WebSocket client. Mock the client module, never the
  components that call it. A mocked async function is `vi.fn().mockResolvedValue(…)`;
  `() => Promise.resolve()` trips `typescript/promise-function-async`.
- On the server: real child processes and real ports are fine in a test (`probe.test.ts` opens one);
  never a port the Demo rig uses (1232, 1234, 5173, 8765, 8766, 8767, 9222) — listen on port 0.

Everything between the entry component and those boundaries stays real — that is the point of the
suite. Mocking a component the flow depends on turns it back into a unit test under the wrong name.
