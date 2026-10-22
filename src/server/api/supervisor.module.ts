import { Module, RequestMethod } from '@nestjs/common'
import type { DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common'

import { OriginMiddleware } from './access'
import { AppsController } from './apps.controller'
import { JsonBodyMiddleware } from './body'
import { FleetController } from './fleet.controller'
import { Hub } from './hub'
import { HubGateway } from './hub.gateway'
import { Jobs } from './jobs'
import { JobsController } from './jobs.controller'
import { Registry } from './registry'
import { SUPERVISOR_OPTIONS } from './supervisor.options'
import type { SupervisorOptions } from './supervisor.types'

/**
 * The supervisor's API over the apps in `options.configs`. Its providers are built by factories
 * with explicit tokens: tsx and the build compile with esbuild, which emits no decorator metadata.
 */
@Module({})
export class SupervisorModule implements NestModule {
  /** The module serving `options`. */
  static forRoot(options: SupervisorOptions): DynamicModule {
    return {
      module: SupervisorModule,
      controllers: [FleetController, AppsController, JobsController],
      providers: [
        { provide: SUPERVISOR_OPTIONS, useValue: options },
        { provide: Registry, useFactory: () => new Registry(options.configs) },
        { provide: Jobs, useFactory: () => new Jobs(options.cli, options.env) },
        {
          provide: Hub,
          useFactory: (registry: Registry, jobs: Jobs) => new Hub(registry, jobs, options.hub),
          inject: [Registry, Jobs]
        },
        HubGateway
      ]
    }
  }

  /** Checks the origin before anything else, then reads JSON bodies. */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(OriginMiddleware, JsonBodyMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL })
  }
}
