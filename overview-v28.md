# v28 · 云同步引擎上线

> 部署链接（稳定复用，数据不丢）：https://b0316fa3e720430387c07bf2e0bf924b.app.workbuddy.link

## 本版做了什么

云同步引擎一次性接入，**凭据由你在 App 内填写，不需要发我**。基于 Supabase REST 直连（fetch，零 SDK 依赖），本地优先、离线可用、匿名登录零 PII、Android 与未来 iOS 通用。

### 新增
- **`src/services/cloudSync.ts`** — 同步核心
  - 匿名登录 / 自动刷新令牌（`wb.sync.auth.v1`，不参与同步，避免回环）
  - `pushAll`：扫描所有 `wb.*` 键，upsert 到云端 `sync_rows(user_id, key, value, updated_at, deleted_at)`
  - `pullSince`：增量拉取 `updated_at > lastSyncAt` 的行
  - `applyPull`：远端覆盖写回本地；`deleted_at` 非空则删除对应键（多端收敛）
  - `testConnection`：匿名登录 + 读一行，验证 URL/key/schema 全链路
  - `pushOnly`（自动 push 用）/ `syncNow`（手动）/ `pullOnly`（启动静默）三个入口
  - `isSyncing` + `onSyncingChange`：同步中状态，防回环 + UI 转圈
  - 错误细分：404=未建表、401/403=RLS 未配、400-anon=匿名登录未开启
- **`src/utils/syncManager.ts`** — 自动同步管理器
  - 订阅 store 变更，防抖 5s 自动 `pushOnly`（仅上传，不拉取，不打断编辑）
  - 网络恢复 / 页面恢复可见时触发一次
  - `setSyncing` 期间短路，push 不修改本地状态，天然不回环

### 改动
- `src/store/createStore.ts`：挂载 `useStore.getState` / `useStore.subscribe`（zustand 风格），供非 React 场景订阅
- `src/screens/MoreScreen.tsx`：数据同步卡片改为可点开 **SyncModal**
  - Project URL 与 anon public key 输入（草稿式，保存时才写回）
  - 测试连接 / 启用开关 / 立即同步 / 上次同步时间 / 同步中转圈 / 首配三步提示
- `src/App.tsx`：启动初始化 SyncManager；已启用且已配置则静默 `pullOnly` 一次（有新数据才 reload）
- `src/components/common/Icons.tsx`：新增 Cloud / RefreshCw / Upload
- `supabase/schema.sql`：`value` 改 `text`（零损往返，不在库内查询）
- 版本号 → `2026-08-19-v28`

### 同步策略
- **首次同步（lastSyncAt=0）**：只 Push（上传本地到云端，不拉取覆盖，避免丢本地数据）
- **后续同步**：Pull 增量 → apply → 刷新内存 → Push 全量
- **冲突**：以 `updated_at` 最新者胜（打卡/记账冲突极少，无需 CRDT）
- **重置收敛**：本地 `reset()` 把空数组 push 上去，多端 pull 后自动删除对应数据

## 你现在要做的（3 步，在 Supabase 控制台 + App 内）

1. Supabase 控制台 → **SQL Editor** → 粘贴执行 `supabase/schema.sql`
2. Supabase 控制台 → **Authentication → Providers → Anonymous** → 开启匿名登录
3. 打开 App → 更多 → 数据同步 → 填 **Project URL** + **anon public key** → 点「测试连接」→ 通过后启用开关 + 「立即同步」

> ⚠️ 只填 anon key（public，已受 RLS 限制），不要填 service_role。
> 凭据只存在你本地 localStorage，不上传、不发我。

## 任务状态
- ✅ #96 云同步架构落地
- ✅ #99 v28 云同步引擎
- 仍 pending：安卓原生打包/发布（#93）、测试（#94）等，待云同步验证通过后推进

## 关联文件
- `cloud-sync-plan.md` — 架构与 Runbook（已更新为 v28 已上线）
- `supabase/schema.sql` — 建表 + RLS（待你在控制台执行）
