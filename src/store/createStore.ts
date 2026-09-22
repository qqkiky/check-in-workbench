import { useCallback, useRef, useSyncExternalStore } from 'react'

type Listener = () => void
type StateUpdater<T> = Partial<T> | ((state: T) => Partial<T>)

/**
 * Minimal zero-dependency reimplementation of zustand's `create` API.
 * Supports `useStore()` (whole state) and `useStore(selector)` forms.
 */
export function create<T>(initializer: (set: (partial: StateUpdater<T>) => void, get: () => T) => T) {
  let state: T
  const listeners = new Set<Listener>()

  const getState = () => state

  const setState = (partial: StateUpdater<T>) => {
    const next = typeof partial === 'function' ? (partial as (s: T) => Partial<T>)(state) : partial
    state = { ...state, ...next }
    listeners.forEach((l) => l())
  }

  state = initializer(setState, getState)

  function useStore(): T
  function useStore<R>(selector: (state: T) => R): R
  function useStore<R>(selector?: (state: T) => R) {
    const subscribe = useCallback((cb: Listener) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    }, [])

    const cache = useRef<{ value: unknown; has: boolean }>({ value: undefined, has: false })

    const getSnapshot = useCallback(() => {
      const next = selector ? selector(getState()) : getState()
      if (cache.current.has && Object.is(next, cache.current.value)) {
        return cache.current.value
      }
      cache.current = { value: next, has: true }
      return next
    }, [selector])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as R | T
  }

  // 暴露 getState / subscribe，供非 React 场景使用（云同步管理器订阅变更防抖 push）
  ;(useStore as any).getState = getState
  ;(useStore as any).subscribe = (cb: Listener) => {
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }

  return useStore
}
