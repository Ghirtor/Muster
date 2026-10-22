import { useSyncExternalStore } from 'react'

import { parseRoute } from '../routes'
import type { Route } from '../routes.types'

/** Calls `onChange` whenever the hash changes. */
const listen = (onChange: VoidFunction): VoidFunction => {
  window.addEventListener('hashchange', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
  }
}

/** The page the location hash names, so a page reloads where it was. */
const useRoute = (): Route => {
  const hash = useSyncExternalStore(listen, () => location.hash)
  return parseRoute(hash)
}

export default useRoute
