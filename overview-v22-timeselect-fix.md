# v22 修复：原生时间选择器白字看不见

**日期**：2026-08-14
**链接不变**：`https://74a2a90b75584bceb0dd46cd1d7430ca.bj8.agentos-app.net`
**版本**：`2026-08-14-v22`（SW 缓存名 `daka-2026-08-14-v22`）

## 问题
打卡（记时长）与时间线「记一笔 / 编辑记事」弹窗里，时钟（原生 `type="time"` 输入框）的文字是白色，在浅色卡片上看不见、无法选择。

## 根因
原生日期/时间输入框的文字颜色由浏览器 UA 按 `color-scheme` 决定。项目此前未声明 `color-scheme`，且输入框没有显式深色文字类 —— 系统处于深色模式时，UA 默认把这类控件文字渲染成白色，叠在浅色背景上即「白字看不见」。

## 修复
在 `src/index.css` 的 `@layer base` 中新增全局规则，一次性覆盖全部原生时间/日期输入（共 10 处：打卡、时间线记一笔、记账收支/转账弹窗、任务表单、今日时间线日期选择等）：

```css
input[type='time'],
input[type='date'],
input[type='datetime-local'] {
  color-scheme: light;        /* 让原生滚轮/弹层以浅色渲染，深色文字 */
  color: #1c1c1e !important;  /* 输入框内显示值强制深色，防止继承白字 */
}
```

`color-scheme: light` 同时修复「输入框内文字」与「系统原生选择滚轮」两处；`!important` 确保即便组件带了 `text-white` 类也能强制深色，保证可见性。

## 验证
- 构建成功（878 模块，3.48s），产物哈希：`main-CmFwRVWp.js` / `index-CV5MiUoY.css`。
- 线上 curl 校验：`index.html` 引用新哈希；`sw.js` 缓存名 `daka-2026-08-14-v22`；线上 CSS 含 `color-scheme:light;color:#1c1c1e!important`。

## 手机端提示
若仍显示旧版，硬刷新一次即可加载 v22（SW 缓存已随版本号变化自动失效）。
