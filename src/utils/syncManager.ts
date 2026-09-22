/**
 * 云同步管理器
 * ----------------------------------------------------------------------------
 * 职责：订阅 store 变更，防抖 5s 后自动 push 本地数据到云端（仅 push，不拉取，
 * 不刷新本地，避免打断用户当前编辑）。App 上线/页面恢复可见时也触发一次。
 *
 * 不做的事：不负责 pull（拉取由 App 启动时的 pullOnly 与手动「立即同步」承担）。
 * push 不修改本地状态 → 不会触发自身回环（setSyncing 期间也会短路）。
 */

import { useStore } from '@/store'
import { pushOnly, isSyncing } from '@/services/cloudSync'
import type { AppSettings } from '@/types'

let timer: ReturnType<typeof setTimeout> | null = null
let unsub: (() => void) | null = null
let started = false

const DEBOUNCE_MS = 5000

// store 在运行时挂载了 getState / subscribe（zustand 风格，见 createStore.ts），
// 这里给出类型断言便于在 React 之外取用。
const storeApi = useStore as unknown as {
  subscribe?: (cb: () => void) => () => void
  getState?: () => { settings: AppSettings }
}

/** 初始化同步管理器。在 App 顶层调用一次即可，重复调用幂等。 */
export function initSyncManager() {
  if (started) return
  started = true

  // 订阅 store 任意变更 → 防抖 push
  if (storeApi.subscribe) {
    unsub = storeApi.subscribe(() => schedulePush())
  }

  // 网络恢复 / 页面恢复可见 → 立即排程一次（防抖仍生效）
  window.addEventListener('online', schedulePush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedulePush()
  })
}

function schedulePush() {
  const s = storeApi.getState?.().settings
  if (!s || !s.cloudSyncEnabled) return
  if (!s.supabaseUrl || !s.supabaseAnonKey) return
  if (isSyncing()) return // 正在同步，跳过本次排程
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    timer = null
    const cur = storeApi.getState?.().settings
    if (!cur || !cur.cloudSyncEnabled) return
    await pushOnly(cur) // 静默 push，错误不外抛
  }, DEBOUNCE_MS)
}

/** 停止同步管理器（一般不需要，留作测试/卸载用） */
export function stopSyncManager() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (unsub) {
    unsub()
    unsub = null
  }
  started = false
}
