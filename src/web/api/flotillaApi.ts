import { createApi } from '@reduxjs/toolkit/query/react'

import { axiosBaseQuery } from './axiosBaseQuery'
import type {
  AppAction,
  AppView,
  ConfigText,
  Health,
  Job,
  JobDetail,
  ServerMessage,
  Validation
} from './flotillaApi.types'
import { subscribe } from './socket'

export const APPS_TAG = 'Apps' as const
export const CONFIG_TAG = 'Config' as const

const LOG_KEEP = 256 * 1024

/** The app list with one status message applied, or null when the list must be fetched again. */
const applyStatus = (apps: AppView[], message: ServerMessage): AppView[] | null => {
  if (message.type !== 'status') return apps
  const app = apps.find((other) => other.id === message.app)
  if (app === undefined || app.ok !== (message.snapshot !== null)) return null
  return apps.map((other) => {
    if (other.id !== message.app) return other
    if (other.ok && message.snapshot !== null) return { ...other, snapshot: message.snapshot }
    if (!other.ok && message.problems !== null) return { ...other, problems: message.problems }
    return other
  })
}

/** `jobs` with `job` in place of its older copy, newest first. */
const upsertJob = (jobs: Job[], job: Job): Job[] =>
  [job, ...jobs.filter((other) => other.id !== job.id)].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt)
  )

/** A path segment, escaped. */
const segment = (value: string): string => encodeURIComponent(value)

/**
 * The supervisor's API. Reads are queries kept live by the WebSocket: each cache entry subscribes
 * to its topic while it is in use (`status` for the app list, `jobs` for jobs and their output,
 * `log:<app>:<key>` for a log) and folds the messages into its data.
 */
export const flotillaApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery,
  tagTypes: [APPS_TAG, CONFIG_TAG],
  endpoints: (build) => ({
    getHealth: build.query<Health, undefined>({ query: () => ({ url: '/health' }) }),

    listApps: build.query<AppView[], undefined>({
      query: () => ({ url: '/apps' }),
      providesTags: [APPS_TAG],
      onCacheEntryAdded: async (_arg, api) => {
        await api.cacheDataLoaded.catch(() => undefined)
        const stop = subscribe(['status'], (message) => {
          const apps = api.getCacheEntry().data
          if (apps === undefined) return
          const next = applyStatus(apps, message)
          if (next === null) api.dispatch(flotillaApi.util.invalidateTags([APPS_TAG]))
          else api.updateCachedData(() => next)
        })
        await api.cacheEntryRemoved
        stop()
      }
    }),

    getConfig: build.query<ConfigText, string>({
      query: (app) => ({ url: `/apps/${segment(app)}/config` }),
      providesTags: (_result, _error, app) => [{ type: CONFIG_TAG, id: app }]
    }),

    validateConfig: build.mutation<Validation, { app: string; text: string }>({
      query: ({ app, text }) => ({
        url: `/apps/${segment(app)}/config/validate`,
        method: 'POST',
        data: { text }
      })
    }),

    saveConfig: build.mutation<AppView, { app: string; text: string }>({
      query: ({ app, text }) => ({
        url: `/apps/${segment(app)}/config`,
        method: 'PUT',
        data: { text }
      }),
      invalidatesTags: (_result, error, { app }) =>
        error === undefined ? [APPS_TAG, { type: CONFIG_TAG, id: app }] : []
    }),

    startAction: build.mutation<Job, AppAction>({
      query: ({ app, ...action }) => ({
        url: `/apps/${segment(app)}/actions`,
        method: 'POST',
        data: action
      })
    }),

    listJobs: build.query<Job[], undefined>({
      query: () => ({ url: '/jobs' }),
      transformResponse: (jobs: Job[]) => jobs.reduce(upsertJob, []),
      onCacheEntryAdded: async (_arg, api) => {
        await api.cacheDataLoaded.catch(() => undefined)
        const stop = subscribe(['jobs'], (message) => {
          if (message.type !== 'job') return
          api.updateCachedData((jobs) => upsertJob(jobs, message.job))
        })
        await api.cacheEntryRemoved
        stop()
      }
    }),

    getJob: build.query<JobDetail, string>({
      query: (id) => ({ url: `/jobs/${segment(id)}` }),
      onCacheEntryAdded: async (id, api) => {
        await api.cacheDataLoaded.catch(() => undefined)
        const stop = subscribe(['jobs'], (message) => {
          api.updateCachedData((detail) => {
            if (message.type === 'job-output' && message.id === id) detail.output += message.text
            if (message.type === 'job' && message.job.id === id) detail.job = message.job
          })
        })
        await api.cacheEntryRemoved
        stop()
      }
    }),

    cancelJob: build.mutation<Job, string>({
      query: (id) => ({ url: `/jobs/${segment(id)}`, method: 'DELETE' })
    }),

    followLog: build.query<string, { app: string; key: string }>({
      queryFn: () => ({ data: '' }),
      onCacheEntryAdded: async ({ app, key }, api) => {
        await api.cacheDataLoaded
        const stop = subscribe([`log:${app}:${key}`], (message) => {
          if (message.type !== 'log') return
          api.updateCachedData((text) =>
            (message.reset ? message.text : text + message.text).slice(-LOG_KEEP)
          )
        })
        await api.cacheEntryRemoved
        stop()
      }
    })
  })
})

export const {
  useGetHealthQuery,
  useListAppsQuery,
  useGetConfigQuery,
  useValidateConfigMutation,
  useSaveConfigMutation,
  useStartActionMutation,
  useListJobsQuery,
  useGetJobQuery,
  useCancelJobMutation,
  useFollowLogQuery
} = flotillaApi
