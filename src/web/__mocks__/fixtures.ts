import type {
  ConfigView,
  Holder,
  Job,
  LaunchVerdict,
  ReadyApp,
  RigSnapshot
} from '../api/musterApi.types'

export const REPO = 'C:\\dev\\Demo'

/** A two-process rig config, `api` on 7001 and `web` on 7002 after it. */
export const configOf = (overrides: Partial<ConfigView> = {}): ConfigView => ({
  name: 'Demo',
  repo: REPO,
  instances: {
    mode: 'one-per-machine',
    max: 1,
    lock: 'C:\\Users\\me\\.muster\\demo.lock',
    staleAfterMs: 4 * 3_600_000,
    whenBusy: 'fail',
    killImages: ['node.exe']
  },
  buildGroups: {},
  processes: [
    {
      key: 'api',
      label: 'API',
      ports: [7001],
      cwd: REPO,
      cmd: 'dotnet run',
      env: {},
      after: [],
      timeoutMs: 60_000,
      onFailure: []
    },
    {
      key: 'web',
      label: 'Web',
      ports: [7002],
      cwd: REPO,
      cmd: 'npm run dev',
      env: {},
      after: ['api'],
      timeoutMs: 60_000,
      onFailure: []
    }
  ],
  ready: [{ kind: 'ports', ports: [7001, 7002], timeoutMs: 60_000 }],
  tools: [],
  logs: 'C:\\Users\\me\\.muster\\logs\\demo',
  ...overrides
})

/** A lock taken from `repo` an hour before 2026-10-22 10:00 UTC, this checkout's when it is `REPO`. */
export const lockOf = (repo: string): Holder => ({
  repo,
  branch: 'main',
  reason: 'demo',
  since: '2026-10-22T09:00:00.000Z',
  mine: repo === REPO
})

/** What the engine says a launch meets under `holders`: held when one is ours, else queued behind the first. */
const verdictOf = (holders: Holder[]): LaunchVerdict => {
  const mine = holders.find((holder) => holder.mine)
  if (mine !== undefined) return { kind: 'held', lock: mine }
  const first = holders.at(0)
  return first === undefined
    ? { kind: 'free', takesOver: null }
    : { kind: 'queue', behind: first, ahead: 0 }
}

/** The rig stopped, or running under `holders` when there are any. */
export const snapshotOf = (
  holders: Holder[] = [],
  overrides: Partial<RigSnapshot> = {}
): RigSnapshot => {
  const up = holders.length > 0
  return {
    state: up ? 'up' : 'down',
    holders,
    queue: [],
    foreign: false,
    launch: verdictOf(holders),
    ports: [
      { port: 7001, key: 'api', label: 'API', up },
      { port: 7002, key: 'web', label: 'Web', up }
    ],
    listening: up ? 2 : 0,
    total: 2,
    ...overrides
  }
}

/** The Demo app as the supervisor lists it. */
export const appOf = (snapshot: RigSnapshot = snapshotOf()): ReadyApp => ({
  id: 'demo',
  file: 'C:\\Users\\me\\dev\\demo\\muster.yaml',
  ok: true,
  config: configOf(),
  snapshot
})

/** A job of the Demo app; finished ok unless `overrides` say otherwise. */
export const jobOf = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  app: 'demo',
  action: 'up',
  args: ['up', '--app', 'demo'],
  state: 'done',
  pid: 42,
  exitCode: 0,
  outcome: 'ok',
  startedAt: '2026-10-22T09:30:00.000Z',
  endedAt: '2026-10-22T09:31:00.000Z',
  ...overrides
})
