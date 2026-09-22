import { create } from './createStore'
import type { Task, CheckInRecord, Category, AppSettings, CategoryId, Note, TimelineEntry, Transaction, AcctCategory, Account, Transfer } from '@/types'
import { DEFAULT_CATEGORIES, DEFAULT_ACCT_CATEGORIES, DEFAULT_ACCT_ACCOUNTS } from '@/types'
import { storage } from '@/services/storage'
import { todayStr, friendlyDate, fmtDate, dt } from '@/utils/date'
import { generateSeedData } from '@/utils/seed'
import { taskOccursOnDate } from '@/utils/recurrence'
import { syncTaskToCalendar, removeTaskFromCalendar } from '@/capacitor/task-calendar'

interface StoreState {
  tasks: Task[]
  records: CheckInRecord[]
  categories: Category[]
  settings: AppSettings
  notes: Note[]
  timelineEntries: TimelineEntry[]
  // 记账模块
  transactions: Transaction[]
  acctCategories: AcctCategory[]
  accounts: Account[]
  transfers: Transfer[]
  initialized: boolean

  // Actions
  init: () => void
  reload: () => void
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  archiveTask: (id: string) => void
  restoreTask: (id: string) => void
  reorderTasks: (ids: string[]) => void

  addRecord: (record: Omit<CheckInRecord, 'id'>) => void
  deleteRecord: (id: string) => void

  addCategory: (cat: Omit<Category, 'id'>) => string
  updateCategory: (id: string, patch: Partial<Category>) => void
  deleteCategory: (id: string) => void

  addNote: (content: string) => void
  updateNote: (id: string, content: string) => void
  deleteNote: (id: string) => void

  // 时间线（日历记事本）手动记事
  addTimelineNote: (entry: { date: string; startTime: string; endTime?: string; content: string; categoryId?: string; emoji?: string }) => void
  updateTimelineEntry: (id: string, patch: { startTime?: string; endTime?: string; content?: string; categoryId?: string; emoji?: string }) => void
  deleteTimelineEntry: (id: string) => void

  // 记账 actions
  addTransaction: (txn: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  addAcctCategory: (cat: Omit<AcctCategory, 'id' | 'order'>) => string
  updateAcctCategory: (id: string, patch: Partial<AcctCategory>) => void
  deleteAcctCategory: (id: string) => void
  addAccount: (acc: Omit<Account, 'id'>) => string
  updateAccount: (id: string, patch: Partial<Account>) => void
  deleteAccount: (id: string) => void
  addTransfer: (tr: Omit<Transfer, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTransfer: (id: string, patch: Partial<Transfer>) => void
  deleteTransfer: (id: string) => void

  updateSettings: (patch: Partial<AppSettings>) => void

  reset: () => void
  restoreSnapshot: (data: {
    tasks: Task[]
    records: CheckInRecord[]
    categories: Category[]
    settings: AppSettings
    notes?: Note[]
    timelineEntries?: TimelineEntry[]
  }) => void

  // Selectors
  getTodayTasks: () => Array<Task & { completed: boolean; record?: CheckInRecord }>
  getPendingTasks: () => Task[]
  getOverdueTasks: () => Task[]
  getTasksByCategory: (categoryId: string) => Task[]
  getTasksByRange: (start: Date, end: Date) => Array<Task & { completed: boolean; record?: CheckInRecord }>
  getRecordsByDate: (date: string) => CheckInRecord[]
  getRecordsInRange: (start: Date, end: Date) => CheckInRecord[]
}

function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useStore = create<StoreState>((set, get) => ({
  tasks: [],
  records: [],
  categories: DEFAULT_CATEGORIES,
  settings: storage.getSettings(),
  notes: [],
  timelineEntries: [],
  transactions: [],
  acctCategories: [],
  accounts: [],
  transfers: [],
  initialized: false,

  init() {
    if (storage.isInitialized()) {
      set({
        tasks: storage.getTasks(),
        records: storage.getRecords(),
        categories: storage.getCategories(),
        settings: storage.getSettings(),
        notes: storage.getNotes(),
        timelineEntries: storage.getTimelineEntries(),
        transactions: storage.getAcctTransactions(),
        acctCategories: storage.getAcctCategories(),
        accounts: storage.getAcctAccounts(),
        transfers: storage.getAcctTransfers(),
        initialized: true,
      })
      return
    }

    // 首次启动使用示例数据
    const seed = generateSeedData()
    storage.setTasks(seed.tasks)
    storage.setRecords(seed.records)
    storage.setCategories(DEFAULT_CATEGORIES)
    storage.markInitialized()
    set({
      tasks: seed.tasks,
      records: seed.records,
      categories: DEFAULT_CATEGORIES,
      notes: [],
      timelineEntries: [],
      transactions: [],
      acctCategories: storage.getAcctCategories(),
      accounts: storage.getAcctAccounts(),
      transfers: storage.getAcctTransfers(),
      initialized: true,
    })
  },

  // 从 localStorage 重新读取（桌面 widget 写入后，APP 内可主动刷新）
  reload() {
    set({
      tasks: storage.getTasks(),
      records: storage.getRecords(),
      categories: storage.getCategories(),
      settings: storage.getSettings(),
      notes: storage.getNotes(),
      timelineEntries: storage.getTimelineEntries(),
      transactions: storage.getAcctTransactions(),
      acctCategories: storage.getAcctCategories(),
      accounts: storage.getAcctAccounts(),
      transfers: storage.getAcctTransfers(),
    })
  },

  addTask(task) {
    const now = Date.now()
    const newTask: Task = {
      ...task,
      id: uid('t'),
      createdAt: now,
      updatedAt: now,
    }
    const next = [newTask, ...get().tasks]
    storage.setTasks(next)
    set({ tasks: next })
    // 同步到系统日历提醒（原生平台生效，Web 端 no-op）
    void syncTaskToCalendar(newTask)
  },

  updateTask(id, patch) {
    const next = get().tasks.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
    )
    storage.setTasks(next)
    set({ tasks: next })
    // 同步到系统日历：满足提醒条件则 upsert，否则移除以免残留旧提醒
    const updated = next.find((t) => t.id === id)
    if (updated) {
      if (updated.reminderEnabled && updated.scheduledTime && updated.scheduledDate) {
        void syncTaskToCalendar(updated)
      } else {
        void removeTaskFromCalendar(id)
      }
    }
  },

  deleteTask(id) {
    const next = get().tasks.filter((t) => t.id !== id)
    storage.setTasks(next)
    set({ tasks: next })
    void removeTaskFromCalendar(id)
  },

  archiveTask(id) {
    get().updateTask(id, { archivedAt: Date.now() })
  },

  restoreTask(id) {
    get().updateTask(id, { archivedAt: undefined })
  },

  reorderTasks(ids) {
    const map = new Map(get().tasks.map((t) => [t.id, t]))
    const next = ids.map((id) => map.get(id)).filter(Boolean) as Task[]
    storage.setTasks(next)
    set({ tasks: next })
  },

  addRecord(record) {
    const newRec: CheckInRecord = { ...record, id: uid('r') }
    const next = [newRec, ...get().records]
    storage.setRecords(next)
    set({ records: next })
  },

  deleteRecord(id) {
    const next = get().records.filter((r) => r.id !== id)
    storage.setRecords(next)
    set({ records: next })
  },

  addCategory(cat) {
    const id = uid('cat')
    const next = [...get().categories, { ...cat, id }]
    storage.setCategories(next)
    set({ categories: next })
    return id
  },

  updateCategory(id, patch) {
    const next = get().categories.map((c) =>
      c.id === id ? { ...c, ...patch } : c
    )
    storage.setCategories(next)
    set({ categories: next })
  },

  deleteCategory(id) {
    const next = get().categories.filter((c) => c.id !== id)
    storage.setCategories(next)
    set({ categories: next })
  },

  addNote(content) {
    const text = content.trim()
    if (!text) return
    const now = Date.now()
    const note: Note = { id: uid('n'), content: text, createdAt: now, updatedAt: now }
    const next = [note, ...get().notes]
    storage.setNotes(next)
    set({ notes: next })
  },

  deleteNote(id) {
    const next = get().notes.filter((n) => n.id !== id)
    storage.setNotes(next)
    set({ notes: next })
  },

  updateNote(id, content) {
    const text = content.trim()
    if (!text) return
    const now = Date.now()
    const next = get().notes.map((n) => (n.id === id ? { ...n, content: text, updatedAt: now } : n))
    storage.setNotes(next)
    set({ notes: next })
  },

  addTimelineNote(entry) {
    const text = entry.content.trim()
    if (!text) return
    const newEntry: TimelineEntry = {
      id: uid('te'),
      kind: 'note',
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      content: text,
      categoryId: entry.categoryId,
      emoji: entry.emoji,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const next = [newEntry, ...get().timelineEntries]
    storage.setTimelineEntries(next)
    set({ timelineEntries: next })
  },

  updateTimelineEntry(id, patch) {
    const next = get().timelineEntries.map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e
    )
    storage.setTimelineEntries(next)
    set({ timelineEntries: next })
  },

  deleteTimelineEntry(id) {
    const next = get().timelineEntries.filter((e) => e.id !== id)
    storage.setTimelineEntries(next)
    set({ timelineEntries: next })
  },

  updateSettings(patch) {
    const next = { ...get().settings, ...patch }
    storage.setSettings(next)
    set({ settings: next })
  },

  // ===================== 记账 =====================
  addTransaction(txn) {
    const now = Date.now()
    const newTxn: Transaction = { ...txn, id: uid('tx'), createdAt: now, updatedAt: now }
    const next = [newTxn, ...get().transactions]
    storage.setAcctTransactions(next)
    set({ transactions: next })
  },

  updateTransaction(id, patch) {
    const next = get().transactions.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
    )
    storage.setAcctTransactions(next)
    set({ transactions: next })
  },

  deleteTransaction(id) {
    const next = get().transactions.filter((t) => t.id !== id)
    storage.setAcctTransactions(next)
    set({ transactions: next })
  },

  addAcctCategory(cat) {
    const id = uid('ac')
    const list = get().acctCategories
    const maxOrder = list.reduce((m, c) => Math.max(m, c.order), -1)
    const next = [...list, { ...cat, id, order: maxOrder + 1 }]
    storage.setAcctCategories(next)
    set({ acctCategories: next })
    return id
  },

  updateAcctCategory(id, patch) {
    const next = get().acctCategories.map((c) => (c.id === id ? { ...c, ...patch } : c))
    storage.setAcctCategories(next)
    set({ acctCategories: next })
  },

  deleteAcctCategory(id) {
    const next = get().acctCategories.filter((c) => c.id !== id)
    storage.setAcctCategories(next)
    set({ acctCategories: next })
  },

  addAccount(acc) {
    const id = uid('acc')
    const list = get().accounts
    const next = [...list, { ...acc, id, isDefault: list.length === 0 ? true : acc.isDefault }]
    storage.setAcctAccounts(next)
    set({ accounts: next })
    return id
  },

  updateAccount(id, patch) {
    // 设为默认时，清除其它默认
    let next = get().accounts.map((a) => (a.id === id ? { ...a, ...patch } : a))
    if (patch.isDefault) {
      next = next.map((a) => (a.id === id ? a : { ...a, isDefault: false }))
    }
    storage.setAcctAccounts(next)
    set({ accounts: next })
  },

  deleteAccount(id) {
    const next = get().accounts.filter((a) => a.id !== id)
    storage.setAcctAccounts(next)
    set({ accounts: next })
  },

  // ---------- 转账（账户间划转，不计入收支） ----------
  addTransfer(tr) {
    const now = Date.now()
    const newTr: Transfer = { ...tr, id: uid('tf'), createdAt: now, updatedAt: now }
    const next = [newTr, ...get().transfers]
    storage.setAcctTransfers(next)
    set({ transfers: next })
  },

  updateTransfer(id, patch) {
    const next = get().transfers.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
    )
    storage.setAcctTransfers(next)
    set({ transfers: next })
  },

  deleteTransfer(id) {
    const next = get().transfers.filter((t) => t.id !== id)
    storage.setAcctTransfers(next)
    set({ transfers: next })
  },

  reset() {
    // 真正清空：任务与记录置空，分类恢复默认，保持已初始化标记避免重新播种示例数据
    storage.setTasks([])
    storage.setRecords([])
    storage.setCategories(DEFAULT_CATEGORIES)
    storage.setNotes([])
    storage.setTimelineEntries([])
    storage.setAcctTransactions([])
    storage.setAcctCategories(DEFAULT_ACCT_CATEGORIES)
    storage.setAcctAccounts(DEFAULT_ACCT_ACCOUNTS)
    storage.setAcctTransfers([])
    storage.markInitialized()
    set({
      tasks: [],
      records: [],
      categories: DEFAULT_CATEGORIES,
      notes: [],
      timelineEntries: [],
      transactions: [],
      acctCategories: DEFAULT_ACCT_CATEGORIES,
      accounts: DEFAULT_ACCT_ACCOUNTS,
      transfers: [],
      initialized: true,
    })
  },

  restoreSnapshot(data) {
    storage.setTasks(data.tasks)
    storage.setRecords(data.records)
    storage.setCategories(data.categories)
    storage.setSettings(data.settings)
    storage.setNotes(data.notes ?? [])
    storage.setTimelineEntries(data.timelineEntries ?? [])
    storage.markInitialized()
    set({
      tasks: data.tasks,
      records: data.records,
      categories: data.categories,
      settings: data.settings,
      notes: data.notes ?? [],
      timelineEntries: data.timelineEntries ?? [],
      initialized: true,
    })
  },

  getTodayTasks() {
    const today = new Date()
    const todayStr = fmtDate(today)
    const dow = today.getDay()
    const tasks = get().tasks.filter((t) => !t.archivedAt)
    return tasks
      .filter((t) => taskOccursOnDate(t, today))
      .map((task) => {
        const record = get().records.find(
          (r) => r.taskId === task.id && r.date === todayStr
        )
        return { ...task, completed: !!record, record }
      })
      .sort((a, b) => {
        const ta = a.scheduledTime || '99:99'
        const tb = b.scheduledTime || '99:99'
        return ta.localeCompare(tb)
      })
  },

  getPendingTasks() {
    const today = new Date()
    const todayStr = fmtDate(today)
    return get().tasks
      .filter((t) => !t.archivedAt)
      .filter((t) => taskOccursOnDate(t, today))
      .filter((t) => {
        const record = get().records.find(
          (r) => r.taskId === t.id && r.date === todayStr
        )
        return !record
      })
  },

  getOverdueTasks() {
    const now = new Date()
    const today = fmtDate(now)
    const tasks = get().tasks.filter((t) => !t.archivedAt)
    return tasks.filter((t) => {
      const todayRec = get().records.find(
        (r) => r.taskId === t.id && r.date === today
      )
      if (todayRec) return false
      if (!t.scheduledTime) return false
      const [hh, mm] = t.scheduledTime.split(':').map(Number)
      const scheduled = new Date(now)
      scheduled.setHours(hh, mm, 0, 0)
      return scheduled < now
    })
  },

  getTasksByCategory(categoryId) {
    return get().tasks.filter((t) => t.categoryId === categoryId)
  },

  // 按时间范围返回该区间内「应完成」的任务（含完成状态），用于本日/本周/当月/今年维度
  getTasksByRange(start: Date, end: Date) {
    const s = dt.startOfDay(start).getTime()
    const e = dt.endOfDay(end).getTime()
    // 区间内每一天
    const days: Date[] = []
    let cur = new Date(s)
    while (cur.getTime() <= e) {
      days.push(new Date(cur))
      cur = dt.addDays(cur, 1)
    }
    const records = get().records
    return get().tasks
      .filter((t) => !t.archivedAt && !t.isQuick)
      .filter((t) => {
        // 范围内任意一天命中出现规则即纳入
        return days.some((d) => taskOccursOnDate(t, d))
      })
      .map((task) => {
        // 完成状态：区间内是否至少打卡一次（以「今日」代表进度，便于卡片展示）
        const todayStr = fmtDate(new Date())
        const record = records.find(
          (r) => r.taskId === task.id && r.date >= fmtDate(start) && r.date <= fmtDate(end)
        )
        const completed = !!record
        // 卡片用「今日是否完成」决定勾选态；若区间非今日，则用区间内任意打卡
        const todayRecord = records.find((r) => r.taskId === task.id && r.date === todayStr)
        return { ...task, completed, record, completedToday: !!todayRecord }
      })
      .sort((a, b) => {
        const ta = a.scheduledTime || '99:99'
        const tb = b.scheduledTime || '99:99'
        return ta.localeCompare(tb)
      })
  },

  getRecordsByDate(date) {
    return get().records.filter((r) => r.date === date)
  },

  getRecordsInRange(start, end) {
    const s = start.getTime()
    const e = end.getTime()
    return get().records.filter((r) => {
      const t = new Date(r.date).getTime()
      return t >= s && t <= e
    })
  },
}))