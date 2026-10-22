# Testing rules

Rules for writing, naming and running Jest suites under `src/`. `jest.config.js` runs two projects:
`web` (jsdom, `src/web/`) and `server` (node, `src/server/`). Add `--selectProjects web` or
`--selectProjects server` to run one.

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

- `jest.config.js` sets no `testMatch`, so discovery falls back to jest's default
  `**/?(*.)+(spec|test).[jt]s?(x)`.
- `collectCoverageFrom`'s `!**/*.{test,spec}.{ts,tsx,js,jsx}` keeps test files from being measured
  as coverage targets. Coverage is a CI-tracked metric (`.github/workflows/ci.yml` runs
  `npm test -- --ci --coverage` and keeps the report).

So do **not** name a suite `*.integration.tsx`, `*.itest.tsx`, or anything else that drops
`.test.` — jest will not run it *and* coverage will count it as uncovered source, dragging the
reported percentage down. Excluding test files from coverage is deliberate: they execute close to
100% by construction, so measuring them inflates the number and hides gaps in real source. An
integration suite still contributes its coverage to the source files it exercises.

## Running a single kind

Jest 30 renamed these flags to the plural form; the singular `--testPathPattern` now errors.

```
npm test -- --testPathIgnorePatterns='\.integration\.'   # unit only — fast inner loop
npm test -- --testPathPatterns='\.integration\.'         # integration only
```

Both run from the repo root. Go through `npm test` rather than a bare `npx jest`: the `server`
project runs as native ESM and needs the `--experimental-vm-modules` the script passes. Split them
into separate CI jobs only once the integration suites are slow enough to be worth it.

## What an integration suite may mock

Mock only what jsdom or the bundler cannot provide, and say why in a comment on the mock:

- Heavy leaves with no bearing on the flow: charts, the log console's virtualised list.
- The API boundary — the dashboard's fetch/WebSocket client. Mock the client module, never the
  components that call it. A mocked async function is `jest.fn().mockResolvedValue(…)`;
  `() => Promise.resolve()` trips `typescript/promise-function-async`.
- On the server: real child processes and real ports are fine in a test (`probe.test.ts` opens one);
  never a port the Demo rig uses (1232, 1234, 5173, 8765, 8766, 8767, 9222) — listen on port 0.

Everything between the entry component and those boundaries stays real — that is the point of the
suite. Mocking a component the flow depends on turns it back into a unit test under the wrong name.
