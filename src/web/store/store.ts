import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'

import { flotillaApi } from '../api/flotillaApi'

/** A store holding the API cache; tests make their own so no cache leaks between them. */
export const makeStore = () => {
  const store = configureStore({
    reducer: { [flotillaApi.reducerPath]: flotillaApi.reducer },
    middleware: (getDefault) => getDefault().concat(flotillaApi.middleware)
  })
  setupListeners(store.dispatch)
  return store
}

export const store = makeStore()
