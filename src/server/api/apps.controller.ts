import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'

import type { RigSnapshot } from '../engine/rig.types'
import { ApiFailure } from './failure'
import { Jobs } from './jobs'
import type { Action, ActionRequest } from './jobs.types'
import { tailLog } from './logs'
import { Registry, validate } from './registry'
import type { AppEntry, LoadedEntry } from './registry.types'
import { appView } from './views'
import type { AppView } from './views.types'

const ACTIONS = new Set<Action>(['up', 'down', 'release'])
const TAIL_BYTES = 64 * 1024

/** An action request from a JSON body, or the reason it is not one. */
export const parseAction = (body: unknown): ActionRequest | string => {
  if (typeof body !== 'object' || body === null) return 'expected a JSON object'
  const raw = body as Record<string, unknown>
  if (!ACTIONS.has(raw.action as Action)) return 'action must be up, down or release'
  for (const name of ['repo', 'reason'] as const) {
    if (raw[name] !== undefined && typeof raw[name] !== 'string') return `${name} must be text`
  }
  for (const name of ['wait', 'force'] as const) {
    if (raw[name] !== undefined && typeof raw[name] !== 'boolean')
      return `${name} must be true or false`
  }
  return raw as unknown as ActionRequest
}

/** The `text` field of a JSON body; a 400 when there is none. */
const textOf = (body: unknown): string => {
  const text = (body as { text?: unknown } | null)?.text
  if (typeof text !== 'string') throw new ApiFailure(400, 'expected {text}')
  return text
}

/** One app's config, live state, lock, queue, logs and actions. */
@Controller('apps')
export class AppsController {
  constructor(
    private readonly registry: Registry,
    private readonly jobs: Jobs
  ) {}

  /** Every app, whether or not its config loads. */
  @Get()
  async list(): Promise<AppView[]> {
    return await Promise.all(
      this.registry.list().map(async (entry) => await appView(this.registry, entry))
    )
  }

  /** One app. */
  @Get(':id')
  async one(@Param('id') id: string): Promise<AppView> {
    return await appView(this.registry, this.entryOf(id))
  }

  /** The config's text and its problems. */
  @Get(':id/config')
  config(@Param('id') id: string): { file: string; text: string; problems: string[] | null } {
    const entry = this.entryOf(id)
    return { file: entry.file, text: this.registry.text(entry), problems: entry.problems }
  }

  /** Saves new config text, refusing (422) one that does not load. */
  @Put(':id/config')
  async save(@Param('id') id: string, @Body() body: unknown): Promise<AppView> {
    const entry = this.entryOf(id)
    const saved = this.registry.save(entry, textOf(body))
    if (!saved.ok) throw new ApiFailure(422, 'invalid config', { problems: saved.problems })
    const reloaded = this.registry.list().find((other) => other.file === entry.file) ?? entry
    return await appView(this.registry, reloaded)
  }

  /** The problems with config text, saving nothing. */
  @Post(':id/config/validate')
  @HttpCode(200)
  check(@Param('id') id: string, @Body() body: unknown): object {
    const entry = this.entryOf(id)
    const result = validate(textOf(body), entry.file)
    return result.ok ? { ok: true, problems: [] } : result
  }

  /** Starts an action as a CLI job; 409 while another one runs. */
  @Post(':id/actions')
  @HttpCode(202)
  act(@Param('id') id: string, @Body() body: unknown): unknown {
    const entry = this.entryOf(id)
    if (entry.problems !== null) {
      throw new ApiFailure(409, 'the config does not load', { problems: entry.problems })
    }
    const parsed = parseAction(body)
    if (typeof parsed === 'string') throw new ApiFailure(400, parsed)
    const started = this.jobs.start(entry, parsed)
    if (!started.ok)
      throw new ApiFailure(409, 'an action is already running', { job: started.running })
    return started.job
  }

  /** The live snapshot. */
  @Get(':id/status')
  async status(@Param('id') id: string): Promise<RigSnapshot> {
    return await this.registry.rigOf(this.loadedOf(id)).snapshot()
  }

  /** The instance mode and who holds the rig. */
  @Get(':id/lock')
  async lock(@Param('id') id: string): Promise<object> {
    const entry = this.loadedOf(id)
    const { holders, foreign, launch } = await this.registry.rigOf(entry).snapshot()
    return { mode: entry.config.instances.mode, holders, foreign, launch }
  }

  /** Who waits for the rig. */
  @Get(':id/queue')
  async queue(@Param('id') id: string): Promise<RigSnapshot['queue']> {
    return (await this.registry.rigOf(this.loadedOf(id)).snapshot()).queue
  }

  /** The tail of one process's log, `bytes` long (64 KB by default). */
  @Get(':id/logs/:key')
  logs(@Param('id') id: string, @Param('key') key: string, @Query('bytes') bytes?: string): object {
    const entry = this.loadedOf(id)
    if (!entry.config.processes.some((p) => p.key === key)) throw new ApiFailure(404, 'not found')
    const length = Number(bytes ?? TAIL_BYTES)
    const file = this.registry.rigOf(entry).logOf(key)
    return { key, file, ...tailLog(file, Number.isFinite(length) ? length : TAIL_BYTES) }
  }

  /** The app named `id`; a 404 when there is none. */
  private entryOf(id: string): AppEntry {
    const entry = this.registry.get(id)
    if (entry === null) throw new ApiFailure(404, 'no such app')
    return entry
  }

  /** The app named `id` with a config that loads; a 404 otherwise, as it has no live state. */
  private loadedOf(id: string): LoadedEntry {
    const entry = this.entryOf(id)
    if (entry.problems !== null) throw new ApiFailure(404, 'not found')
    return entry
  }
}
