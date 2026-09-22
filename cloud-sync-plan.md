# 云同步落地方案（Supabase，本地优先）

> 状态：✅ 引擎已上线（v28）。用户已在 supabase.com 建免费项目。
> 剩余唯一前置项：用户在 Supabase 控制台执行 `supabase/schema.sql` + 开启 Anonymous 登录，
> 然后在 App「更多 → 数据同步」里填入 Project URL 与 anon key（无需发我，App 内直接配置）。
> 关联需求：用户确认「需要云同步」；平台先 Android、iOS 后续（Capacitor 包裹，同步层两端通用，无需重写）。

## 核心原则
1. **本地存储永远是真相源**。所有写操作先落本地 `localStorage`（wb.* 键），再异步入同步队列。断网照常用。
2. **云端是副本**。Supabase 只做「多设备 / 多端」镜像，绝不阻断本地体验。
3. **零 PII**。用 Supabase Auth **匿名登录**，不收集邮箱/手机号。
4. **增量 + 软删除**。每个实体已有 `updatedAt`；同步行额外带 `deletedAt`，多端以此收敛。

## 同步模型
- 同步单元 = 一个 `wb.*` 键（与现有备份/恢复机制天然一致，未来新增模块自动纳入）。
- 远端表 `sync_rows(user_id, key, value, updated_at, deleted_at)`。
- **Push**：读取本地所有 `wb.*` 键 → upsert 到远端（`updated_at = now()`）。
- **Pull**：拉取 `updated_at > lastSyncAt` 的行 → 与本地按 `updated_at` 最新者胜合并写回；`deleted_at` 非空的行 → 删除本地对应键。
- **触发**：App 启动自动 Pull 一次；用户点「立即同步」执行 Pull + Push；后续接入「关键写操作后防抖 Push」。
- **冲突**：以 `updated_at` 最新者胜（打卡/记账冲突极少，无需 CRDT）。

## 你需要做的（唯一前置项，已完成建项目）
1. ✅ 在 https://supabase.com 新建一个 **免费** 项目（你已完成）。
2. 控制台 → **SQL Editor** → 粘贴 `supabase/schema.sql` 全量执行（建 sync_rows 表 + RLS 策略）。
3. 控制台 → **Authentication → Providers → Anonymous** → 开启「匿名登录」。
4. 控制台 → **Project Settings → API** → 复制 **Project URL** 与 **anon public key**。
5. 打开 App → 更多 → 数据同步 → 填入 URL 与 anon key → 点「测试连接」→ 通过后启用开关 + 「立即同步」。

> ⚠️ 只填 anon key（public，已受 RLS 限制），**不要**填 service_role key。
> 凭据只存在你本地 localStorage（`wb.sync.auth.v1`），不上传、不发我。

## 我已做的（v28 已上线）
- `src/services/cloudSync.ts`：基于 `fetch` 直连 Supabase REST（PostgREST + GoTrue，零 SDK 依赖），含匿名登录/刷新、push 全量、pull 增量 + 软删除收敛、testConnection、pushOnly/syncNow/pullOnly 三种入口。
- `src/utils/syncManager.ts`：订阅 store 变更防抖 5s 自动 push；上线/页面可见时触发；setSyncing 期间短路防回环。
- `src/store/createStore.ts`：挂载 `getState`/`subscribe`（zustand 风格），供非 React 场景订阅。
- `src/screens/MoreScreen.tsx`：数据同步卡片改为可点开 `SyncModal`（URL/anon key 输入、测试连接、启用开关、立即同步、上次同步时间、状态徽标）。
- `src/App.tsx`：启动初始化 SyncManager；若已启用且已配置则静默 pull 一次其它设备变更。
- 类型检查通过，已部署到稳定链接（数据不丢）。

## 平台与发布（按你确认）
- 先 Android：Capacitor 包裹现有 Web（~90% 复用），出 AAB 上架 Google Play。
- iOS 后续：同一 Web 代码 + `npx cap add ios`，复用同一套云同步与导航，无需重写。
