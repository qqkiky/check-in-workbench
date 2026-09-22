# 打卡工作台 v19 四项功能增强

部署链接：https://74a2a90b75584bceb0dd46cd1d7430ca.bj8.agentos-app.net （强刷清缓存验证 v19）

## 1. 预算设置与限额提醒
- 入口：「更多 → 月度预算」弹窗设置每月预算（留空/0 = 关闭）。
- 提醒：记账页滚动区顶部横幅。当月支出 ≥ 预算 80% 显示黄色「接近预算，仅剩 X」；> 100% 显示红色「已超出预算 X」。
- 落点：`types/index.ts`(budget 字段) · `storage.ts`(默认 0) · `MoreScreen.tsx`(入口+弹窗) · `AccountingScreen.tsx`(横幅)。

## 2. 打卡时间规则优化（跨天 / 同分钟）
- 允许开始→结束跨天（如 23:30 → 次日 01:00）：时长正确 +24h 计算。
- 允许开始=结束（同一分钟内完成）：时长记为 0，不再被拦截。
- 打卡时间弹窗去掉"结束需晚于开始"硬校验，预览改为「跨天·次日结束 / 同一分钟内完成」。
- 落点：`HomeScreen.doCheckIn` · `CheckInTimeModal` · 三处 `diffMinutes`(utils/timeline、TimelineNoteModal、TodayTimeline) · 新增 `timelineDurationSeconds`。

## 3. 日历热力图分类筛选
- 趋势页「日历热力 / 分类追踪」顶部新增分类选择条（全部 + 各分类）。
- 年度色块：按选中分类过滤每日打卡数，并以该分类颜色着色。
- 阅读(分类)色块：仅展示选中分类的周/月矩阵、日历色块与完成度。
- 落点：`TrendsScreen`(catFilter+CategoryChips+过滤数据) · `CalendarHeatmap`(color/label) · `CategoryHeatmap`(filterCategoryId)。

## 4. 复盘时间统计扩展
- 月度 / 年度复盘新增卡片「时间线分类 vs 打卡分类 时间投入」。
- 左栏「打卡分类」= 现有按 durationSeconds 汇总；右栏「时间线分类」= 按记事起止时间(支持跨天)汇总，两栏各列 Top4 分类与时长。
- 落点：`MonthlyReview`/`AnnualReview`(新增 entries prop + timelineDurationSeconds 汇总 + 卡片) · `TrendsScreen`(传 timelineEntries)。

## 验证
- `npx tsc --noEmit` 通过（修复两处：useMemo 解构漏 timelineByCat/timelineTotalSec）。
- `npx vite build` 成功（877 模块，gzip 主包 ~59kB）。
- 版本号：`2026-08-09-v19`。
