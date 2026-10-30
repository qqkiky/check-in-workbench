import { initPrivateStorage } from './services/appStorage'

// Initialize encrypted native state before evaluating any store module.
initPrivateStorage().then(() => import('./renderApp')).catch(() => {
  const root = document.getElementById('root')
  if (root) root.textContent = '加密数据读取失败。请勿卸载或清除数据，解锁手机后重试。'
})
window.addEventListener('private-storage-error', () => {
  if (document.getElementById('storage-error')) return
  const banner = document.createElement('div')
  banner.id = 'storage-error'
  banner.textContent = '数据尚未成功保存，请保留当前页面并先导出备份。'
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#b91c1c;color:white;padding:12px'
  document.body.appendChild(banner)
})
