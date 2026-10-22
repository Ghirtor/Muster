import type { Repair, RigConfig } from '../engine/config.types'
import { launchOrder } from '../engine/order'
import type { Registry } from './registry'
import type { AppEntry } from './registry.types'
import type { AppView, ConfigView, RepairView } from './views.types'

/** A repair as JSON carries it: the signature as its pattern's source. */
const repairView = (repair: Repair): RepairView => ({
  match: repair.match.source,
  steps: repair.steps,
  cleanup: repair.cleanup,
  ...(repair.cwd === undefined ? {} : { cwd: repair.cwd }),
  vars: repair.vars
})

/** A loaded config as the API sends it, its processes in launch order. */
export const configView = (config: RigConfig): ConfigView => ({
  name: config.name,
  repo: config.repo,
  instances: config.instances,
  buildGroups: config.buildGroups,
  processes: launchOrder(config.processes).order.map((proc) => ({
    ...proc,
    onFailure: proc.onFailure.map(repairView)
  })),
  ready: config.ready,
  tools: config.tools.map((tool) => ({ ...tool, onFailure: tool.onFailure.map(repairView) })),
  logs: config.logs
})

/** An app as the API lists it: its config and live snapshot, or why its config does not load. */
export const appView = async (registry: Registry, entry: AppEntry): Promise<AppView> => {
  if (entry.problems !== null) {
    return { id: entry.id, file: entry.file, ok: false, problems: entry.problems }
  }
  const snapshot = await registry.rigOf(entry).snapshot()
  return { id: entry.id, file: entry.file, ok: true, config: configView(entry.config), snapshot }
}
