# v30 · 删除中央 FAB + 修复安装弹窗

> 部署链接（稳定复用，数据不丢）：https://b0316fa3e720430387c07bf2e0bf924b.app.workbuddy.link
> 线上已确认：`sw.js` = 2026-08-19-v30，bundle 中 `FabOption` 计数 = 0（FAB 已删干净）

## 本版改了什么（应你两条反馈）

### 1. 删除底部正中间的记账 FAB（蓝色加号按钮）
- 之前那个 FAB 出现在每一页（还一度因定位 bug 跑到屏幕顶部压标题）——现在**彻底删除**。
- 底部导航恢复为纯 4 个 Tab：**Do · 记账 · 回顾 · 更多**，中间不再有悬浮按钮。
- **记账入口没丢**：点底部「记账」Tab 进 AccountingScreen，里面自带「记一笔」按钮（支出/收入/转账都从那进），跟原来一样好用。
- 删掉的代码：`App.tsx` 的 FAB 按钮、`fabSheet` 弹层、`pickFab/openFab`、`FabOption` 组件、相关 state 与 store 取值、`TransactionModal`/`TransferModal` 的 App 级调用（这两个组件仍在 AccountingScreen 内部使用）。

### 2. 修复小米浏览器不再自动弹安装窗
- **根因**：`src/utils/pwa.ts` 的 `initPWAInstall` 调了 `e.preventDefault()`，这会把浏览器的**原生安装提示**吞掉。Chrome 上我们靠自定义按钮兜底，但小米浏览器依赖原生提示——被吞后就不弹了。
- **修复**：移除 `preventDefault()`，放任浏览器自动弹原生安装提示（小米/Chrome 都会自动弹）。`installApp()` 加 try-catch 兜底，浏览器已弹则回退到「更多→安装到手机」的手动引导。

## 你现在验证

1. **刷新页面**（或关掉重开）。如果手机上还是旧版，清一下浏览器缓存 / 长按刷新强制更新（PWA Service Worker 用版本号缓存，v30 会自动更新，但偶有延迟）。
2. **看底部**：4 个 Tab，中间没有蓝色加号了 → FAB 删除成功。
3. **记账**：点「记账」Tab → 里面的「记一笔」按钮照常能记支出/收入/转账。
4. **小米安装弹窗**：用小米浏览器打开链接，应该会自动弹安装提示了。如果还是不弹，把小米浏览器版本告诉我，我再针对 MiuiBrowser 的 quirk 调（部分小米版本要在「设置→应用→小米浏览器→权限→桌面快捷方式」开权限）。

## 关联
- 云同步仍正常工作（v28 引擎不受影响），凭据在你本地，多设备同步照旧。
- `cloud-sync-plan.md` 仍是云同步的总 Runbook。
