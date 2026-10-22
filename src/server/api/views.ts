import type { Repair, RigConfig } from '../engine/config.types'
import { launchOrder } from '../engine/order'
import type { ConfigView, RepairView } from './views.types'

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
