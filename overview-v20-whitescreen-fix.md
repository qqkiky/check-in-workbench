# 回退 v20 + 白屏根治

## 问题
手机端打开链接持续白屏。

## 根因
`public/sw.js` 的缓存名 `const CACHE = 'daka-v12'` 自 v12 起从未随版本更新。每次 `vite build` 资源带新哈希，但手机旧 SW 长期缓存已删除的旧 `index.html`，导致始终回退到失效页面。

## 处理
1. 按用户要求回退到 v20：撤销 v21「DO 周切换 + 限定补卡」全部改动（HomeScreen / TaskCard / date.ts / TodayTimeline / CategoryHeatmap / version.ts）。`CheckInRecord` 的 `isMakeup/makeupAt` 可选字段保留以避级联报错，UI 已移除 → 行为即 v20。
2. 根治白屏：`sw.js` 缓存名改为 `daka-__APP_VERSION__`，新增 vite 插件 `injectSwVersion` 在 build 时把 `src/version.ts` 的版本注入 `dist/sw.js`。每次部署缓存名随版本变化，旧缓存被自动清除。

## 验证
- `tsc --noEmit` EXIT 0；`vite build` 877 模块成功。
- `dist/sw.js` = `daka-2026-08-10-v20`。
- 线上 `sw.js` 缓存名已为 `daka-2026-08-10-v20`，`index.html`/JS 均 HTTP 200。

## 用户侧操作
关闭应用 / 标签页并重新打开（或硬刷新）一次，触发新 SW 接管并清除旧白屏缓存。

链接：https://74a2a90b75584bceb0dd46cd1d7430ca.bj8.agentos-app.net
