import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initPWAInstall } from './utils/pwa'
import { storage } from './services/storage'
import { applyThemeColor, DEFAULT_THEME } from './utils/theme'
import './index.css'

// 在 React 挂载前同步应用主题色，避免首屏强调色闪烁
try {
  applyThemeColor(storage.getSettings().themeColor || DEFAULT_THEME)
} catch {
  applyThemeColor(DEFAULT_THEME)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// 初始化 PWA 安装引导（捕获 beforeinstallprompt）
initPWAInstall()

// 注册 Service Worker（仅生产环境，PWA 离线安装依赖它）
// - updateViaCache: 'none' 让浏览器每次都拉取最新的 sw.js，避免更新被 HTTP 缓存拦住
// - 侦测到新版本时【自动刷新】到最新版（无需手动点击），确保用户不会停留在旧壳子
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let pendingReload = false

  const onControllerChange = () => {
    if (pendingReload) window.location.reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            // 已有旧版本在运行，且新版本已安装完成 → 自动切到新版
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              pendingReload = true
              newWorker.postMessage({ type: 'SKIP_WAITING' })
              // 给当前页面一点时间，然后强制刷新到最新版
              setTimeout(() => window.location.reload(), 1500)
            }
          })
        })
      })
      .catch(() => {
        /* 注册失败不影响正常使用 */
      })
  })
}
