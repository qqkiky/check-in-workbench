// 任务分类（时段/类别）
export type CategoryId =
  | 'morning'    // 上午
  | 'noon'       // 下午
  | 'work'       // 工作
  | 'evening'    // 晚上
  | 'life'       // 生活
  | 'study'      // 阅读
  | 'rest'       // 休息
  | 'invest'     // 投资
  | 'custom'     // 自定义

export interface Category {
  id: CategoryId | string
  name: string
  emoji: string
  icon?: string  // 图标库名称（见 utils/iconLibrary），为空时回退 emoji
  color: string
  timeRange?: string  // 形如 "06:00-12:00"
  order: number
}

// 重复方式
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'

// 任务单元
export interface Task {
  id: string
  title: string
  description?: string
  categoryId: CategoryId | string
  emoji?: string

  // 计划
  scheduledTime?: string  // HH:mm 计划开始时间
  scheduledDate?: string  // YYYY-MM-DD 计划日期
  duration?: number       // 计划分钟数
  recurrence: Recurrence  // 重复方式：不重复 / 每日 / 每周 / 每月
  weekdays?: number[]     // 每周重复日 [0-6]，recurrence==='weekly' 时生效
  monthDay?: number       // 每月几号重复，recurrence==='monthly' 时生效（1-31）
  priority?: 'low' | 'normal' | 'high'

  // 提醒
  reminderEnabled?: boolean  // 是否开启到点提醒
  reminderLead?: number      // 提前提醒分钟数（0=准点，5/15/30/60）

  // 量化目标（如阅读 300/1000 本）
  target?: number
  unit?: string

  // 标记：小事（轻量临时打卡，无计划时间/目标）
  isQuick?: boolean

  // 元数据
  createdAt: number
  updatedAt: number
  archivedAt?: number
}

// 记事本条目
export interface Note {
  id: string
  content: string
  createdAt: number
  updatedAt: number
}

// 时间线手动记事（打卡内容由 CheckInRecord 派生，不在此重复存储）
export interface TimelineEntry {
  id: string
  kind: 'note'
  date: string         // YYYY-MM-DD
  startTime: string    // HH:mm 开始时间
  endTime?: string     // HH:mm 结束时间（可选，用于计算时长）
  content: string
  categoryId?: string  // 可选分类（用于着色）
  emoji?: string
  createdAt?: number
  updatedAt?: number
}

// 打卡记录（每次完成一个任务的实例）
export interface CheckInRecord {
  id: string
  taskId: string
  taskTitle: string
  categoryId: CategoryId | string
  date: string         // YYYY-MM-DD
  startedAt?: number   // 开始时间戳
  completedAt: number  // 完成时间戳
  durationSeconds: number
  progress?: number    // 进度增量
  progressTotal?: number
  note?: string
  isMakeup?: boolean   // 是否为补卡（打卡日期早于实际打卡当天）
  makeupAt?: number    // 补卡实际执行时间戳（用于追溯补卡时间）
}

// 应用设置
export interface AppSettings {
  theme: 'light' | 'dark'
  startOfWeek: 0 | 1        // 0=周日 1=周一
  showLunar: boolean
  notificationEnabled: boolean
  weekStartDay: number
  hapticsEnabled: boolean
  showTimeline?: boolean    // 日视图是否展示「当日时间线」（日历记事本）
  budget?: number           // 月度预算（元），0 或留空表示不启用
  themeColor?: string       // 主题色（hex），驱动全站强调色；默认靛蓝 #4F6EF7
  cloudSyncEnabled?: boolean // 是否启用云同步（Supabase）
  supabaseUrl?: string       // Supabase 项目地址（如 https://xxxx.supabase.co）
  supabaseAnonKey?: string   // Supabase anon key（仅匿名登录用，不含服务角色密钥，无 PII）
  lastSyncAt?: number        // 上次成功同步的时间戳（毫秒）
}

export type ViewMode = 'today' | 'week' | 'month' | 'year' | 'pending' | 'quick'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'morning', name: '上午', emoji: '🌅', color: '#FF9500', timeRange: '06:00-12:00', order: 0 },
  { id: 'noon',    name: '下午', emoji: '☀️', color: '#FFCC00', timeRange: '12:00-18:00', order: 1 },
  { id: 'work',    name: '工作', emoji: '💼', color: '#FF3B30', timeRange: '09:00-18:00', order: 2 },
  { id: 'evening', name: '晚上', emoji: '🌙', color: '#AF52DE', timeRange: '18:00-24:00', order: 3 },
  { id: 'life',    name: '生活', emoji: '🍳', color: '#34C759', order: 4 },
  { id: 'study',   name: '阅读', emoji: '📚', color: '#5AC8FA', order: 5 },
  { id: 'rest',    name: '休息', emoji: '😴', color: '#FF2D55', order: 6 },
  { id: 'invest',  name: '投资', emoji: '💰', color: '#FF9500', order: 7 },
]

export const APP_NAME = '期待'

// ===================== 记账模块 =====================
export type TxnType = 'income' | 'expense'
export type AccountType = 'cash' | 'bank' | 'card' | 'alipay' | 'wechat' | 'other'

// 记账分类（与打卡分类 Category 解耦，独立存储）
export interface AcctCategory {
  id: string
  name: string
  type: TxnType | 'both' // 该分类用于 支出 / 收入 / 通用
  emoji: string
  color: string
  order: number
}

// 账户
export interface Account {
  id: string
  name: string
  type: AccountType
  initialBalance: number
  color: string
  emoji?: string
  isDefault?: boolean
}

// 账目
export interface Transaction {
  id: string
  type: TxnType
  amount: number // 正数
  categoryId: string
  accountId: string
  datetime: number // 时间戳(ms)
  note?: string
  createdAt: number
  updatedAt: number
}

// 转账（账户之间的资金划转）
// 刻意与 Transaction 分离存储：转账既不是收入也不是支出，
// 混入账目会虚增收支总额、污染预算进度与分类占比。
export interface Transfer {
  id: string
  fromAccountId: string // 转出账户
  toAccountId: string // 转入账户
  amount: number // 到账金额（正数）
  fee?: number // 手续费，额外从转出账户扣除（转出账户共减少 amount + fee）
  datetime: number // 时间戳(ms)
  note?: string
  createdAt: number
  updatedAt: number
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: '现金',
  bank: '银行卡',
  card: '信用卡',
  alipay: '支付宝',
  wechat: '微信',
  other: '其他',
}

export const ACCOUNT_TYPE_EMOJI: Record<AccountType, string> = {
  cash: '💵',
  bank: '🏦',
  card: '💳',
  alipay: '🔵',
  wechat: '🟢',
  other: '📦',
}

export const DEFAULT_ACCT_CATEGORIES: AcctCategory[] = [
  // 支出
  { id: 'ac-food', name: '餐饮', type: 'expense', emoji: '🍜', color: '#FF9500', order: 0 },
  { id: 'ac-transport', name: '交通', type: 'expense', emoji: '🚌', color: '#5AC8FA', order: 1 },
  { id: 'ac-shopping', name: '购物', type: 'expense', emoji: '🛍️', color: '#FF2D55', order: 2 },
  { id: 'ac-home', name: '居住', type: 'expense', emoji: '🏠', color: '#AF52DE', order: 3 },
  { id: 'ac-fun', name: '娱乐', type: 'expense', emoji: '🎮', color: '#5856D6', order: 4 },
  { id: 'ac-medical', name: '医疗', type: 'expense', emoji: '💊', color: '#FF3B30', order: 5 },
  { id: 'ac-study', name: '教育', type: 'expense', emoji: '📚', color: '#34C759', order: 6 },
  { id: 'ac-other-exp', name: '其他支出', type: 'expense', emoji: '📦', color: '#8E8E93', order: 7 },
  // 收入
  { id: 'ac-salary', name: '工资', type: 'income', emoji: '💰', color: '#FFCC00', order: 8 },
  { id: 'ac-bonus', name: '奖金', type: 'income', emoji: '🎁', color: '#FF9500', order: 9 },
  { id: 'ac-finance', name: '理财', type: 'income', emoji: '📈', color: '#34C759', order: 10 },
  { id: 'ac-parttime', name: '兼职', type: 'income', emoji: '💼', color: '#5AC8FA', order: 11 },
  { id: 'ac-other-inc', name: '其他收入', type: 'income', emoji: '✨', color: '#8E8E93', order: 12 },
]

export const DEFAULT_ACCT_ACCOUNTS: Account[] = [
  { id: 'acc-cash', name: '现金', type: 'cash', initialBalance: 0, color: '#34C759', emoji: '💵', isDefault: true },
  { id: 'acc-bank', name: '银行卡', type: 'bank', initialBalance: 0, color: '#007AFF', emoji: '🏦' },
  { id: 'acc-alipay', name: '支付宝', type: 'alipay', initialBalance: 0, color: '#1677FF', emoji: '🔵' },
  { id: 'acc-wechat', name: '微信', type: 'wechat', initialBalance: 0, color: '#07C160', emoji: '🟢' },
]