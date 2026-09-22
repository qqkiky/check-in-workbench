/**
 * 云同步引擎（Supabase，本地优先）
 * ----------------------------------------------------------------------------
 * 设计原则：
 * 1. 本地 localStorage 永远是真相源。所有写操作先落本地，再异步 push 到云端。
 *    断网/飞行模式照常用，联网后增量同步，绝不阻断本地体验。
 * 2. 云端是「尽力同步的副本」。Supabase 只做多设备镜像，不参与单端读写。
 * 3. 零 PII：Supabase Auth 匿名登录，不收集邮箱/手机号；RLS 保证仅本人可见。
 * 4. 增量 + 软删除：每个 wb.* 键整体作为一行同步单元，updated_at 做增量 diff，
 *    deleted_at 非空即多端删除收敛。
 *
 * 同步单元 = 一个 wb.* 键（与备份/恢复机制天然一致，未来新增模块自动纳入）。
 * 冲突策略：以 updated_at 最新者胜（打卡/记账冲突极少，无需 CRDT）。
 * ----------------------------------------------------------------------------
 * 零依赖：直接 fetch Supabase REST（PostgREST + GoTrue），不引入 supabase-js。
 */

import type { AppSettings } from '@/types'

const AUTH_KEY = 'wb.sync.auth.v1' // 注意：此键非 wb. 前缀，不参与同步，避免回环

interface AuthState {
  accessToken: string
  refreshToken: string
  userId: string
  expiresAt: number // 毫秒时间戳，过期前 60s 视为过期
}

export interface SyncResult {
  ok: boolean
  pulled?: number
  pushed?: number
  deleted?: number
  needReload?: boolean // 是否拉到了新数据，需调用方刷新内存状态
  error?: string
}

// ---- 同步中状态（供 UI 显示转圈，并防止 push 回环）----
let syncing = false
const syncingListeners = new Set<() => void>()

export function isSyncing() {
  return syncing
}
export function onSyncingChange(l: () => void) {
  syncingListeners.add(l)
  return () => {
    syncingListeners.delete(l)
  }
}
function setSyncing(v: boolean) {
  syncing = v
  syncingListeners.forEach((l) => l())
}

// ---- 工具 ----
function authHeaders(anonKey: string, accessToken?: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: anonKey,
    'Content-Type': 'application/json',
  }
  if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
  return h
}

function parseErr(txt: string): string {
  try {
    const j = JSON.parse(txt)
    return j.message || j.msg || j.error_description || j.error || txt.slice(0, 160)
  } catch {
    return txt.slice(0, 160)
  }
}

function readAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthState
  } catch {
    return null
  }
}

function writeAuth(a: AuthState | null) {
  if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a))
  else localStorage.removeItem(AUTH_KEY)
}

// ---- 匿名登录 / 刷新 ----
async function anonSignUp(url: string, anonKey: string): Promise<AuthState> {
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: authHeaders(anonKey),
    body: '{}',
  })
  if (!res.ok) {
    const txt = await res.text()
    if (res.status === 400 && /anon|disabled|anonymous/i.test(txt))
      throw new Error('匿名登录被关闭：请在 Supabase 控制台 Authentication → Providers → Anonymous 开启')
    throw new Error(`匿名登录失败（${res.status}）：${parseErr(txt)}`)
  }
  const data = await res.json()
  if (!data.access_token || !data.user?.id) throw new Error('匿名登录返回异常，未拿到令牌')
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: data.user.id,
    expiresAt: Date.now() + (data.expires_in ? (data.expires_in - 60) * 1000 : 50 * 60 * 1000),
  }
}

async function refresh(url: string, anonKey: string, refreshToken: string): Promise<AuthState> {
  const res = await fetch(`${url}/auth/v1/refresh?grant_type=refresh_token`, {
    method: 'POST',
    headers: authHeaders(anonKey),
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error('刷新令牌失败')
  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: data.user.id,
    expiresAt: Date.now() + (data.expires_in ? (data.expires_in - 60) * 1000 : 50 * 60 * 1000),
  }
}

/** 确保拿到有效匿名会话；过期则刷新，刷新失败则重新匿名登录 */
export async function ensureAuth(url: string, anonKey: string): Promise<AuthState> {
  let auth = readAuth()
  if (!auth) {
    auth = await anonSignUp(url, anonKey)
    writeAuth(auth)
    return auth
  }
  if (auth.expiresAt <= Date.now()) {
    try {
      auth = await refresh(url, anonKey, auth.refreshToken)
      writeAuth(auth)
    } catch {
      // refresh 失败（令牌被吊销/过期太久）→ 重新匿名登录
      auth = await anonSignUp(url, anonKey)
      writeAuth(auth)
    }
  }
  return auth
}

// ---- 本地键收集 ----
function collectLocalKeys(): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    // 同步所有 wb.* 键；排除同步自身的 auth 键（非 wb. 前缀，天然不在此列）
    if (k && k.startsWith('wb.')) {
      out.push({ key: k, value: localStorage.getItem(k) ?? '' })
    }
  }
  return out
}

// ---- Push：全量上传本地 wb.* 键 ----
async function pushAll(url: string, anonKey: string, auth: AuthState): Promise<number> {
  const rows = collectLocalKeys()
  if (!rows.length) return 0
  const nowIso = new Date().toISOString()
  const body = rows.map((r) => ({
    user_id: auth.userId,
    key: r.key,
    value: r.value,
    updated_at: nowIso,
    deleted_at: null, // 本地存在的键一律置为存活，覆盖远端可能的软删除
  }))
  const res = await fetch(`${url}/rest/v1/sync_rows?on_conflict=user_id,key`, {
    method: 'POST',
    headers: {
      ...authHeaders(anonKey, auth.accessToken),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    if (res.status === 404) throw new Error('数据表不存在：请在 Supabase SQL Editor 执行 schema.sql')
    if (res.status === 401 || res.status === 403) throw new Error('无写入权限：请确认 RLS 策略与匿名登录已开启')
    throw new Error(`上传失败（${res.status}）：${parseErr(txt)}`)
  }
  return rows.length
}

// ---- Pull：增量拉取 updated_at > since 的行，按最新者胜合并写回本地 ----
interface RemoteRow {
  key: string
  value: string
  updated_at: string
  deleted_at: string | null
}

async function pullSince(
  url: string,
  anonKey: string,
  auth: AuthState,
  sinceMs: number,
): Promise<RemoteRow[]> {
  const sinceIso = new Date(sinceMs).toISOString()
  const u = `${url}/rest/v1/sync_rows?select=key,value,updated_at,deleted_at&user_id=eq.${encodeURIComponent(
    auth.userId,
  )}&updated_at=gt.${encodeURIComponent(sinceIso)}`
  const res = await fetch(u, { headers: authHeaders(anonKey, auth.accessToken) })
  if (!res.ok) {
    const txt = await res.text()
    if (res.status === 404) throw new Error('数据表不存在：请在 Supabase SQL Editor 执行 schema.sql')
    throw new Error(`拉取失败（${res.status}）：${parseErr(txt)}`)
  }
  return (await res.json()) as RemoteRow[]
}

/** 将远端行合并写回本地：deleted_at 非空 → 删除对应键；否则覆盖写回 */
function applyPull(rows: RemoteRow[]): { applied: number; deleted: number } {
  let applied = 0
  let deleted = 0
  for (const r of rows) {
    if (r.deleted_at) {
      if (localStorage.getItem(r.key) !== null) {
        localStorage.removeItem(r.key)
        deleted++
      }
    } else {
      localStorage.setItem(r.key, r.value)
      applied++
    }
  }
  return { applied, deleted }
}

// ---- 对外能力 ----

/** 测试连接：匿名登录 + 读一行 sync_rows，验证 URL/key/schema 全链路 */
export async function testConnection(
  url: string,
  anonKey: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  try {
    const auth = await ensureAuth(url.trim(), anonKey.trim())
    const res = await fetch(
      `${url}/rest/v1/sync_rows?select=key&user_id=eq.${encodeURIComponent(auth.userId)}&limit=1`,
      { headers: authHeaders(anonKey.trim(), auth.accessToken) },
    )
    if (!res.ok) {
      if (res.status === 404)
        return { ok: false, error: '数据表不存在：请在 Supabase SQL Editor 执行 schema.sql' }
      return { ok: false, error: `数据表访问失败（${res.status}），请确认已执行 schema.sql` }
    }
    return { ok: true, userId: auth.userId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '连接失败' }
  }
}

/** 仅上传（用于本地写操作后防抖自动 push，不拉取，不刷新本地） */
export async function pushOnly(settings: AppSettings): Promise<SyncResult> {
  const url = settings.supabaseUrl?.trim()
  const anonKey = settings.supabaseAnonKey?.trim()
  if (!url || !anonKey) return { ok: false, error: '未配置' }
  if (syncing) return { ok: false } // 已在同步，跳过避免回环
  try {
    setSyncing(true)
    const auth = await ensureAuth(url, anonKey)
    const pushed = await pushAll(url, anonKey, auth)
    return { ok: true, pushed }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '上传失败' }
  } finally {
    setSyncing(false)
  }
}

/**
 * 完整同步（手动「立即同步」与 App 启动调用）：
 * - 首次同步（lastSyncAt=0）：只 Push（把本地上传到云端，不拉取覆盖，避免丢本地数据）。
 * - 后续同步：Pull 增量 → apply → 刷新内存 → Push 全量。
 * 返回 needReload=true 时，调用方需调用 store.reload() 让内存体现拉到的数据。
 */
export async function syncNow(settings: AppSettings): Promise<SyncResult> {
  const url = settings.supabaseUrl?.trim()
  const anonKey = settings.supabaseAnonKey?.trim()
  if (!url || !anonKey) return { ok: false, error: '请先填写 Supabase URL 与 anon key' }
  try {
    setSyncing(true)
    const auth = await ensureAuth(url, anonKey)
    let pulled = 0
    let deleted = 0
    let needReload = false

    if (settings.lastSyncAt && settings.lastSyncAt > 0) {
      const rows = await pullSince(url, anonKey, auth, settings.lastSyncAt)
      const r = applyPull(rows)
      pulled = r.applied
      deleted = r.deleted
      needReload = rows.length > 0
    }

    const pushed = await pushAll(url, anonKey, auth)
    return { ok: true, pulled, pushed, deleted, needReload }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '同步失败' }
  } finally {
    setSyncing(false)
  }
}

/** 仅拉取（App 启动静默 pull 一次，获取其它设备的最新变更） */
export async function pullOnly(settings: AppSettings): Promise<SyncResult> {
  const url = settings.supabaseUrl?.trim()
  const anonKey = settings.supabaseAnonKey?.trim()
  if (!url || !anonKey) return { ok: false, error: '未配置' }
  if (settings.lastSyncAt === 0 || !settings.lastSyncAt) return { ok: true, pulled: 0 } // 首次不 pull，交给 syncNow 的 push
  try {
    setSyncing(true)
    const auth = await ensureAuth(url, anonKey)
    const rows = await pullSince(url, anonKey, auth, settings.lastSyncAt)
    const r = applyPull(rows)
    return { ok: true, pulled: r.applied, deleted: r.deleted, needReload: rows.length > 0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '拉取失败' }
  } finally {
    setSyncing(false)
  }
}
