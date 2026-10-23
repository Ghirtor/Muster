import os from 'node:os'

import { Controller, Get, HttpCode, Post } from '@nestjs/common'

import { Registry } from './registry'
import { appView } from './views'
import type { AppView } from './views.types'

/** The supervisor as a whole: whether it is alive, and re-reading every registration. */
@Controller()
export class FleetController {
  constructor(private readonly registry: Registry) {}

  /** Alive, with the machine's name. */
  @Get('health')
  health(): { ok: true; hostname: string } {
    return { ok: true, hostname: os.hostname() }
  }

  /** Re-reads the registrations and recipes, then lists the apps as `GET /apps` does. */
  @Post('reload')
  @HttpCode(200)
  async reload(): Promise<AppView[]> {
    this.registry.reload()
    return await Promise.all(
      this.registry.list().map(async (entry) => await appView(this.registry, entry))
    )
  }
}
