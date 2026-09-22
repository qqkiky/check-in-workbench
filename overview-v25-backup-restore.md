# v25 全量数据备份 / 恢复功能

**日期**：2026-08-16（v25）｜**链接**：https://b0316fa3e720430387c07bf2e0bf924b.app.workbuddy.link

## 背景
此前「更多 → 导出/导入」只备份了 `{tasks, records, categories, settings}` 4 类数据，**漏掉了整个记账模块（交易/分类/账户/转账）、记事本、时间线**——这正是你担心换链接会丢的那部分数据。

## 本次改动
在 `src/services/storage.ts` 新增三个基于 `localStorage` 全量扫描的函数（扫描所有 `wb.*` 前缀键，防未来新增模块被遗漏）：

- `exportAllData()` → 导出全部 `wb.*` 键 + 元信息（版本/导出时间）为 JSON 字符串
- `previewBackup(json)` → 仅解析校验，返回来源版本与键数量，**不写入**（覆盖前预览/校验）
- `importAllData(json)` → 写回所有 `wb.*` 键（覆盖当前站数据）

`src/screens/MoreScreen.tsx` 重写导出/导入流程：
- **导出数据**：改用 `exportAllData()`，覆盖打卡、记账、账户、转账、分类、笔记、时间线、设置等**全部模块**
- **导入恢复**：先 `previewBackup` 校验 → 弹确认框 → 确认后 `importAllData` 写回 + `reload()` 刷新内存
- **撤销保护**：导入前自动留存当前数据快照，导入后 8 秒内可「撤销」一键回滚

## 验证
- `tsc --noEmit` 通过；`npm run build` 成功（`main-wst-wSkS.js`）
- Android 原生壳 `cap sync` 同步到 v25
- 线上已含新功能文案，SW 缓存 `daka-2026-08-16-v25`

## 迁移操作（解决上轮链接变更丢数据问题）
1. 在**旧链接**（或任意有数据的实例）点「更多 → 导出数据」，下载 `do-backup-YYYY-MM-DD.json`
2. 在**新链接** `b0316fa3…app.workbuddy.link` 点「更多 → 导入恢复 → 选择备份文件」，导入即可
3. 之后可弃用旧链接

## 注意
- 数据仍存在各链接各自的 `localStorage`（按域名隔离），备份/恢复是跨实例搬数据的唯一手段
- 当前正确链接：`https://b0316fa3e720430387c07bf2e0bf924b.app.workbuddy.link`
- 手机端若显示旧版，硬刷新一次加载 v25
- 「设置 - 数据管理 - 我发布的应用」可管理已发布应用（如删除）
