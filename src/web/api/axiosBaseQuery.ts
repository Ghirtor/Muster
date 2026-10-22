import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import { isAxiosError } from 'axios'

import type { ApiFailure, HttpRequest } from './flotillaApi.types'
import { http } from './http'

/**
 * RTK Query's transport over axios. A refusal becomes an `ApiFailure` carrying the supervisor's
 * `error` and a config's `problems`; no answer at all is status 0.
 */
export const axiosBaseQuery: BaseQueryFn<HttpRequest, unknown, ApiFailure> = async ({
  url,
  method = 'GET',
  data
}) => {
  try {
    const response = await http.request<unknown>({ url, method, data })
    return { data: response.data }
  } catch (error) {
    if (!isAxiosError(error) || error.response === undefined) {
      return { error: { status: 0, message: 'The supervisor is not answering', problems: [] } }
    }
    const body = (error.response.data ?? {}) as { error?: string; problems?: string[] }
    return {
      error: {
        status: error.response.status,
        message: body.error ?? error.message,
        problems: body.problems ?? []
      }
    }
  }
}
