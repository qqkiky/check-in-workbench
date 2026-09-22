# v23 功能：补卡可选择完成日期

**日期**：2026-08-14
**链接不变**：`https://74a2a90b75584bceb0dd46cd1d7430ca.bj8.agentos-app.net`
**版本**：`2026-08-14-v23`（SW 缓存名 `daka-2026-08-14-v23`）

## 问题
补卡（在周视图里点过去未完成的那天任务去打卡）时，完成日期被锁死为「计划日」、开始时间默认成「计划时间」。
- 记录写入的 `date` = 任务实例的计划日，无法改成实际完成的那天；
- 结束时间默认成「今天的当前时钟」叠在计划日上，导致完成时间看着像计划时间。

## 修复
给打卡时间弹窗（`CheckInTimeModal`）增加**「完成日期」选择器**，并把所选日期回传作为记录的 `date` 与 `completedAt` 日期。

### 交互变化
- 弹窗标题：所选日期早于今天 → 「补卡」；否则「记录打卡时间」。
- 新增「完成日期」`type="date"` 输入（默认 = 任务实例日，可编辑）。复用 v22 已修的全局深色文字规则，不会白字。
- 补卡提示：`补卡模式：记录将记到所选日期（YYYY-MM-DD），而非计划时间。`
- 确认按钮：`确认补卡` / `确认打卡` 动态切换。
- 预填优化：过去日补卡时，开始时间默认用任务「计划时间」（如有）否则 `09:00`，结束时间默认计划时间 +30 分（否则 `09:30`）；当天打卡仍默认用当前时间。
- 数据增强：`doCheckIn` 现在写入 `isMakeup` 与 `makeupAt`（当所选日期早于今天），便于追溯。

### 改动文件
- `src/components/tasks/CheckInTimeModal.tsx`：日期选择器 + `onConfirm(start,end,date)` 签名 + `shiftMinutes` 工具。
- `src/screens/HomeScreen.tsx`：`handleCheckIn` 补卡预填逻辑、`confirmCheckIn(start,end,date)`、`doCheckIn` 写入 `isMakeup/makeupAt`、弹窗传 `defaultDate`。
- `src/version.ts` → `2026-08-14-v23`。

## 验证
- 构建成功（878 模块）；线上 `index.html` 引用 `main-0c9AwyO_.js`，`sw.js` 缓存 `daka-2026-08-14-v23`，JS 含「完成日期 / 确认补卡 / 补卡模式」文案。
- 注：部署工具报 `fetch failed` 为超时误报，curl 已交叉验证线上生效。

## 手机端提示
硬刷新一次加载 v23；SW 缓存已随版本号变化自动失效。
