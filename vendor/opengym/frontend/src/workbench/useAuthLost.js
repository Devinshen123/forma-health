import { useSyncExternalStore } from 'react'
import { authLost, subscribeAuthLost } from './context.js'

/** The session-lost notice (workbench/context.js) as React state: null until a 401/403. */
export function useAuthLost() {
  return useSyncExternalStore(subscribeAuthLost, authLost, authLost)
}
