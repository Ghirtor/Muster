import { Controller, Delete, Get, Inject, Param } from '@nestjs/common'

import { ApiFailure } from './failure'
import { Jobs } from './jobs'

/** The actions the supervisor has run, with their output. */
@Controller('jobs')
export class JobsController {
  constructor(@Inject(Jobs) private readonly jobs: Jobs) {}

  /** Every job, newest first. */
  @Get()
  list(): ReturnType<Jobs['list']> {
    return this.jobs.list()
  }

  /** One job and its output. */
  @Get(':id')
  one(@Param('id') id: string): NonNullable<ReturnType<Jobs['get']>> {
    const found = this.jobs.get(id)
    if (found === null) throw new ApiFailure(404, 'no such job')
    return found
  }

  /** Cancels a running job, which takes a queued launch out of the queue. */
  @Delete(':id')
  cancel(@Param('id') id: string): unknown {
    if (this.jobs.get(id) === null) throw new ApiFailure(404, 'no such job')
    if (!this.jobs.cancel(id)) throw new ApiFailure(409, 'the job is not running')
    return this.jobs.get(id)?.job
  }
}
