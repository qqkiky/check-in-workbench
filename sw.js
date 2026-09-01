// 打卡工作台 Service Worker —— 离线优先体验 + 可靠更新
// 策略：导航请求网络优先（保证拿到最新版本），静态资源 stale-while-revalidate。
// 这样每次部署新版本后，用户下次打开即可加载新版，并在有新版本时由页面提示更新。
const CACHE = 'daka-2026-09-01-v41'
const CORE = ['./', './index.html', './widget.html', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './manifest.webmanifest', './widget-manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// 页面发来「跳过等待」，立即激活新版本
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 导航（HTML 页面）：网络优先，失败回退缓存页面（按路径区分主应用 / 小组件）
  if (request.mode === 'navigate') {
    const path = new URL(request.url).pathname
    const fallbackUrl = new URL(path.includes('widget') ? 'widget.html' : 'index.html', self.location).href
    event.respondWith(
      fetch(request)
        .then((res) => {
          // 成功则顺手更新缓存，下次离线也能用
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return res
        })
        .catch(() => caches.match(fallbackUrl).then((r) => r || caches.match(new URL('index.html', self.location).href)))
    )
    return
  }

  // 数据接口（JSON）：网络优先，保证每次打开都能拿到最新资讯/任务数据；离线时回退缓存
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // 静态资源：stale-while-revalidate（先返回缓存保证速度，后台更新缓存）
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
