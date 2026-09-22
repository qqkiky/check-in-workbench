-- ============================================================
-- 打卡工作台 · 云同步 Schema（Supabase / Postgres）
-- 设计原则：本地 localStorage 为唯一真相源，云端是「尽力同步的副本」。
--   - 离线照常用，联网后增量同步，弱网/飞行模式不降级。
--   - 用 Supabase Auth 匿名登录（无需邮箱密码，零 PII）。
--   - 每个 wb.* 键整体作为一行同步单元，天然兼容未来新增模块。
--   - RLS 保证每个用户只能读写自己的行。
-- 用法：在 Supabase 控制台 → SQL Editor 全量粘贴执行即可。
-- ============================================================

create extension if not exists "pgcrypto";

-- 同步行：user_id + key 唯一；value 为 wb.* 键对应的原始字符串（localStorage 里就是 JSON 字符串）；
-- 用 text 而非 jsonb，保证"存什么、读什么"零损往返（我们同步的是不透明字符串，不在库内查询）。
-- updated_at 用于增量 diff；deleted_at 软删除（本地删除后云端标记，便于多端收敛）。
create table if not exists public.sync_rows (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  key         text        not null,
  value       text        not null default '',
  updated_at  timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, key)
);

create index if not exists sync_rows_user_updated
  on public.sync_rows (user_id, updated_at);

-- 行级安全：仅本人可访问
alter table public.sync_rows enable row level security;

drop policy if exists "sync_rows_owner" on public.sync_rows;
create policy "sync_rows_owner" on public.sync_rows
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 注意：需在 Supabase 控制台 Authentication → Providers → Anonymous 开启「匿名登录」，
-- 否则匿名 sign-in 会返回 400。本项目只用匿名身份，不收集任何个人信息。
