import type { ProcessConfig } from './config.types'
import type { LaunchOrder } from './order.types'

/**
 * The processes in launch order: the order they are listed in, except that a process moves after
 * every process its `after` names. Unknown names are ignored here (the config reports them); a
 * circle leaves its members out of `order` and lists them in `cycle`.
 */
export const launchOrder = (processes: ProcessConfig[]): LaunchOrder => {
  const keys = new Set(processes.map((p) => p.key))
  const placed = new Set<string>()
  const order: ProcessConfig[] = []
  let remaining = processes
  while (remaining.length > 0) {
    const next = remaining.find((p) =>
      p.after.every((dependency) => placed.has(dependency) || !keys.has(dependency))
    )
    if (next === undefined) return { order, cycle: remaining.map((p) => p.key) }
    placed.add(next.key)
    order.push(next)
    remaining = remaining.filter((p) => p !== next)
  }
  return { order, cycle: [] }
}
