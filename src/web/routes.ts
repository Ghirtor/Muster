import type { Route } from './routes.types'

/** The page a location hash names; anything unknown is the fleet. */
export const parseRoute = (hash: string): Route => {
  const match = /^#\/apps\/([^/]+)(\/config)?\/?$/.exec(hash)
  const id = decodeURIComponent(match?.at(1) ?? '')
  if (match === null || id === '') return { page: 'fleet' }
  return match.at(2) === undefined ? { page: 'app', id } : { page: 'config', id }
}

/** The hash link to a page. */
export const hrefOf = (route: Route): string => {
  if (route.page === 'fleet') return '#/'
  const app = `#/apps/${encodeURIComponent(route.id)}`
  return route.page === 'app' ? app : `${app}/config`
}
