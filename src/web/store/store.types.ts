import type { makeStore } from './store'

export type AppStore = ReturnType<typeof makeStore>

export type AppDispatch = AppStore['dispatch']
