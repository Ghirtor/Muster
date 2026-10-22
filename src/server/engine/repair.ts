import fs from 'node:fs'
import path from 'node:path'

import type { Repair } from './config.types'

/** `{name}` placeholders in `template` filled from `vars`; an unknown name is left as written. */
export const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) => vars[name] ?? whole)

/** The first repair whose signature appears in `output`, or null when none applies. */
export const findRepair = (repairs: Repair[], output: string): Repair | null =>
  repairs.find((repair) => repair.match.test(output)) ?? null

/**
 * The command a repair runs in `dir`: its steps joined with `&&`, without the steps whose
 * `unlessExists` path is already there. The remedy is chosen after the failure, not before it — a
 * venv that exists is not created again, which would fail on its own locked launcher.
 */
export const repairCommand = (repair: Repair, dir: string): string =>
  repair.steps
    .filter(
      (step) => step.unlessExists === undefined || !fs.existsSync(path.join(dir, step.unlessExists))
    )
    .map((step) => fill(step.run, repair.vars))
    .join(' && ')
