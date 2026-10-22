import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'

import { musterApi } from '../api/musterApi'

/** A store holding the API cache; tests make their own so no cache leaks between them. */
export const makeStore = () => {
  const store = configureStore({
    reducer: { [musterApi.reducerPath]: musterApi.reducer },
    middleware: (getDefault) => getDefault().concat(musterApi.middleware)
  })
  setupListeners(store.dispatch)
  return store
}

export const store = makeStore()
