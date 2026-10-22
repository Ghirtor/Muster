import type { ProcessConfig } from './config.types'

export interface LaunchOrder {
  order: ProcessConfig[]
  cycle: string[]
}
