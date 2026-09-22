import type { Task, CheckInRecord, Category, AppSettings, Note, TimelineEntry, Transaction, AcctCategory, Account, Transfer } from '@/types'
import { DEFAULT_CATEGORIES, DEFAULT_ACCT_CATEGORIES, DEFAULT_ACCT_ACCOUNTS } from '@/types'
import { APP_VERSION } from '@/version'

const KEYS = {
  tasks: 'wb.tasks.v1',
  records: 'wb.records.v1',
  categories: 'wb.categories.v1',
  settings: 'wb.settings.v1',
  notes: 'wb.notes.v1',
  timelineEntries: 'wb.timeline.v1',
  initialized: 'wb.initialized.v1',
  acctTransactions: 'wb.acct.transactions.v1',
  acctCategories: 'wb.acct.categories.v1',
  acctAccounts: 'wb.acct.accounts.v1',
  acctTransfers: 'wb.acct.transfers.v1',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('Storage write failed', e)
  }
}

export const storage = {
  getTasks(): Task[] {
    const raw = read<any[]>(KEYS.tasks, [])
    // 兼容旧数据：将 isRecurring/weekdays 归一化为 recurrence
    return raw.map((t) => {
      if (t && t.recurrence) return t as Task
      const recurrence = t && t.isRecurring
        ? t.weekdays && t.weekdays.length
          ? 'weekly'
          : 'daily'
        : 'none'
      return { ...t, recurrence } as Task
    })
  },
  setTasks(tasks: Task[]) {
    write(KEYS.tasks, tasks)
  },
  getRecords(): CheckInRecord[] {
    return read<CheckInRecord[]>(KEYS.records, [])
  },
  setRecords(records: CheckInRecord[]) {
    write(KEYS.records, records)
  },
  getCategories(): Category[] {
    return read<Category[]>(KEYS.categories, DEFAULT_CATEGORIES)
  },
  setCategories(categories: Category[]) {
    write(KEYS.categories, categories)
  },
  getSettings(): AppSettings {
    const defaults: AppSettings = {
      theme: 'light',
      startOfWeek: 1,
      showLunar: true,
      notificationEnabled: true,
      weekStartDay: 1,
      hapticsEnabled: true,
      budget: 0,
      themeColor: '#4F6EF7',
      cloudSyncEnabled: false,
      supabaseUrl: '',
      supabaseAnonKey: '',
      lastSyncAt: 0,
    }
    // 字段级合并：导入的旧版 settings（如 v23）缺 themeColor/cloudSync 等新字段时，
    // 用默认值补全，避免后续逻辑读到 undefined。
    const parsed = read<Partial<AppSettings>>(KEYS.settings, defaults)
    const settings: AppSettings = { ...defaults, ...parsed }
    // 一次性迁移：旧版默认 notificationEnabled=false，升级后默认开启提醒；
    // 已显式设置过的用户不受影响（迁移标记只写一次）。
    if (!localStorage.getItem('wb.settings.reminderMigrated')) {
      settings.notificationEnabled = true
      write(KEYS.settings, settings)
      localStorage.setItem('wb.settings.reminderMigrated', '1')
    }
    return settings
  },
  setSettings(settings: AppSettings) {
    write(KEYS.settings, settings)
  },
  isInitialized(): boolean {
    return localStorage.getItem(KEYS.initialized) === '1'
  },
  markInitialized() {
    localStorage.setItem(KEYS.initialized, '1')
  },
  getNotes(): Note[] {
    return read<Note[]>(KEYS.notes, [])
  },
  setNotes(notes: Note[]) {
    write(KEYS.notes, notes)
  },
  getTimelineEntries(): TimelineEntry[] {
    const raw = read<any[]>(KEYS.timelineEntries, [])
    // 兼容旧数据：time -> startTime，并补全 kind
    return raw.map((e) => {
      if (e && e.startTime) return e as TimelineEntry
      const startTime = e?.time || '09:00'
      return { ...e, kind: 'note', startTime } as TimelineEntry
    })
  },
  setTimelineEntries(entries: TimelineEntry[]) {
    write(KEYS.timelineEntries, entries)
  },

  // ---------- 记账模块 ----------
  getAcctTransactions(): Transaction[] {
    return read<Transaction[]>(KEYS.acctTransactions, [])
  },
  setAcctTransactions(list: Transaction[]) {
    write(KEYS.acctTransactions, list)
  },
  // 分类：首次（key 不存在）写入默认预设，保证有初始数据
  getAcctCategories(): AcctCategory[] {
    if (localStorage.getItem(KEYS.acctCategories) === null) {
      write(KEYS.acctCategories, DEFAULT_ACCT_CATEGORIES)
      return DEFAULT_ACCT_CATEGORIES
    }
    const list = read<AcctCategory[]>(KEYS.acctCategories, DEFAULT_ACCT_CATEGORIES)
    return list.length ? list : DEFAULT_ACCT_CATEGORIES
  },
  setAcctCategories(list: AcctCategory[]) {
    write(KEYS.acctCategories, list)
  },
  // 账户：同分类，首次写入默认预设
  getAcctAccounts(): Account[] {
    if (localStorage.getItem(KEYS.acctAccounts) === null) {
      write(KEYS.acctAccounts, DEFAULT_ACCT_ACCOUNTS)
      return DEFAULT_ACCT_ACCOUNTS
    }
    const list = read<Account[]>(KEYS.acctAccounts, DEFAULT_ACCT_ACCOUNTS)
    return list.length ? list : DEFAULT_ACCT_ACCOUNTS
  },
  setAcctAccounts(list: Account[]) {
    write(KEYS.acctAccounts, list)
  },
  // 转账：账户间划转，独立存储（不参与收支统计）
  getAcctTransfers(): Transfer[] {
    return read<Transfer[]>(KEYS.acctTransfers, [])
  },
  setAcctTransfers(list: Transfer[]) {
    write(KEYS.acctTransfers, list)
  },

  // ---------- 全量备份 / 恢复 ----------
  // 导出所有以 wb. 为前缀的 localStorage 数据（含记账/笔记/时间线/转账等全部模块），
  // 返回带元信息的 JSON 字符串。采用前缀扫描而非硬编码键，避免未来新增模块被遗漏。
  exportAllData(): string {
    const data: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('wb.')) {
        data[key] = localStorage.getItem(key) ?? ''
      }
    }
    const payload = {
      app: 'checkin-workbench',
      schema: 1,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      data,
    }
    return JSON.stringify(payload, null, 2)
  },
  // 恢复：解析备份 JSON，写回所有 wb.* 键，覆盖当站数据。返回恢复的键数量与来源版本。
  // 失败时抛出异常（由调用方提示用户），不会写入部分数据。
  // 兼容三种历史导出格式：
  //   1) v25+ 当前格式：data 键已是 wb.tasks.v1，值是字符串
  //   2) v23 裸短名格式：data 键是 tasks/records/...（无 wb. 前缀、无 .v1），值是对象（未序列化）
  //   3) 过渡格式：data 键是 tasks.v1（有 .v1 无 wb.）
  // 用 SHORT_TO_FULL 把裸短名映射到 store 实际读取的完整键，否则数据写了但界面读不到。
  importAllData(json: string): { ok: boolean; keys: number; appVersion?: string } {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
      throw new Error('备份文件格式不正确')
    }
    const data = parsed.data as Record<string, unknown>
    // 裸短名 → store 实际读取的完整 localStorage 键
    const SHORT_TO_FULL: Record<string, string> = {
      tasks: KEYS.tasks,
      records: KEYS.records,
      categories: KEYS.categories,
      settings: KEYS.settings,
      notes: KEYS.notes,
      timelineEntries: KEYS.timelineEntries,
      timeline: KEYS.timelineEntries,
      initialized: KEYS.initialized,
      acctTransactions: KEYS.acctTransactions,
      acctCategories: KEYS.acctCategories,
      acctAccounts: KEYS.acctAccounts,
      acctTransfers: KEYS.acctTransfers,
    }
    let count = 0
    Object.keys(data).forEach((k) => {
      let key: string
      if (SHORT_TO_FULL[k]) {
        // v23 裸短名 → 完整键
        key = SHORT_TO_FULL[k]
      } else if (k.startsWith('wb.')) {
        // v25+ 已是完整键
        key = k
      } else {
        // 其它过渡格式：补 wb. 前缀兜底
        key = `wb.${k}`
      }
      const raw = data[k]
      // 旧导出值可能是对象（未序列化），统一序列化为字符串再存
      const store = typeof raw === 'string' ? raw : JSON.stringify(raw)
      localStorage.setItem(key, store)
      count++
    })
    return { ok: true, keys: count, appVersion: parsed.appVersion }
  },
  // 预览：仅解析备份文件，返回来源版本与包含的数据键数量，不写入任何数据。
  // 用于在覆盖前给用户确认信息。
  previewBackup(json: string): { ok: boolean; keys: number; appVersion?: string; error?: string } {
    try {
      const parsed = JSON.parse(json)
      if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
        return { ok: false, keys: 0, error: '备份文件格式不正确' }
      }
      const data = parsed.data as Record<string, unknown>
      const SHORT_TO_FULL: Record<string, string> = {
        tasks: KEYS.tasks, records: KEYS.records, categories: KEYS.categories,
        settings: KEYS.settings, notes: KEYS.notes, timeline: KEYS.timelineEntries,
        timelineEntries: KEYS.timelineEntries, initialized: KEYS.initialized,
        acctTransactions: KEYS.acctTransactions, acctCategories: KEYS.acctCategories,
        acctAccounts: KEYS.acctAccounts, acctTransfers: KEYS.acctTransfers,
      }
      const wbKeys = Object.keys(data).map((k) =>
        SHORT_TO_FULL[k] ? SHORT_TO_FULL[k] : (k.startsWith('wb.') ? k : `wb.${k}`)
      )
      return { ok: true, keys: wbKeys.length, appVersion: parsed.appVersion }
    } catch {
      return { ok: false, keys: 0, error: 'JSON 解析失败，请检查内容' }
    }
  },
}