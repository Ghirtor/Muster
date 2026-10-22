import { useDispatch } from 'react-redux'

import type { AppDispatch } from './store.types'

/** The store's dispatch, typed for thunks such as RTK Query's `initiate`. */
const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>()

export default useAppDispatch
