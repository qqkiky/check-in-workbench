// 二十四节气 + 常见节日数据，用于「DO 页日视图」倒计时展示
// 节气采用各年通用近似日期（实际有 ±1 天的浮动），对倒计时展示已经够用
// 数据格式：{ month: 1-12, day: 1-31, name, type }

export interface CalendarEvent {
  /** 节日名 */
  name: string
  /** 月 1-12 */
  month: number
  /** 日 1-31 */
  day: number
  /** 'solar' = 二十四节气；'festival' = 节日 */
  type: 'solar' | 'festival'
  /** 同月同日重复出现时，农历字段：'lunar' 表示用农历日期匹配 */
  lunar?: boolean
  /** 实际公历日期 YYYY-MM-DD，由 getUpcomingEvents 填充 */
  date?: string
}

// 二十四节气（按公历日期，约 ±1 天）
const SOLAR_TERMS_2026: { name: string; date: string }[] = [
  { name: '小寒', date: '2026-01-05' },
  { name: '大寒', date: '2026-01-20' },
  { name: '立春', date: '2026-02-04' },
  { name: '雨水', date: '2026-02-19' },
  { name: '惊蛰', date: '2026-03-06' },
  { name: '春分', date: '2026-03-21' },
  { name: '清明', date: '2026-04-05' },
  { name: '谷雨', date: '2026-04-20' },
  { name: '立夏', date: '2026-05-06' },
  { name: '小满', date: '2026-05-21' },
  { name: '芒种', date: '2026-06-06' },
  { name: '夏至', date: '2026-06-21' },
  { name: '小暑', date: '2026-07-07' },
  { name: '大暑', date: '2026-07-22' },
  { name: '立秋', date: '2026-08-07' },
  { name: '处暑', date: '2026-08-23' },
  { name: '白露', date: '2026-09-07' },
  { name: '秋分', date: '2026-09-23' },
  { name: '寒露', date: '2026-10-08' },
  { name: '霜降', date: '2026-10-23' },
  { name: '立冬', date: '2026-11-07' },
  { name: '小雪', date: '2026-11-22' },
  { name: '大雪', date: '2026-12-07' },
  { name: '冬至', date: '2026-12-22' },
]

// 常见公历节日
const SOLAR_FESTIVALS: CalendarEvent[] = [
  { name: '元旦', month: 1, day: 1, type: 'festival' },
  { name: '情人节', month: 2, day: 14, type: 'festival' },
  { name: '妇女节', month: 3, day: 8, type: 'festival' },
  { name: '植树节', month: 3, day: 12, type: 'festival' },
  { name: '愚人节', month: 4, day: 1, type: 'festival' },
  { name: '劳动节', month: 5, day: 1, type: 'festival' },
  { name: '青年节', month: 5, day: 4, type: 'festival' },
  { name: '儿童节', month: 6, day: 1, type: 'festival' },
  { name: '建党节', month: 7, day: 1, type: 'festival' },
  { name: '建军节', month: 8, day: 1, type: 'festival' },
  { name: '教师节', month: 9, day: 10, type: 'festival' },
  { name: '国庆节', month: 10, day: 1, type: 'festival' },
  { name: '万圣节', month: 10, day: 31, type: 'festival' },
  { name: '光棍节', month: 11, day: 11, type: 'festival' },
  { name: '平安夜', month: 12, day: 24, type: 'festival' },
  { name: '圣诞节', month: 12, day: 25, type: 'festival' },
]

// 农历节日（用农历月日表示，dateOfLunar 通过 utils/date 计算）
const LUNAR_FESTIVALS: { name: string; month: number; day: number }[] = [
  { name: '除夕', month: 12, day: 30 }, // 注：除夕是农历年最后一天，30 视为近似
  { name: '春节', month: 1, day: 1 },
  { name: '元宵节', month: 1, day: 15 },
  { name: '龙抬头', month: 2, day: 2 },
  { name: '端午节', month: 5, day: 5 },
  { name: '七夕节', month: 7, day: 7 },
  { name: '中元节', month: 7, day: 15 },
  { name: '中秋节', month: 8, day: 15 },
  { name: '重阳节', month: 9, day: 9 },
  { name: '腊八节', month: 12, day: 8 },
]

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

function fmtYMD(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 计算指定公历日期是当年第几天（0-based） */
function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

/**
 * 从某日起，向后查找 24 节气中下一个节气（近似日期；跨年自动顺延到次年）
 */
function nextSolarTerm(from: Date): { name: string; date: string } | null {
  const y = from.getFullYear()
  const candidates = SOLAR_TERMS_2026.flatMap((t) => [
    { ...t, date: `${y}-${t.date.slice(5)}` },
    { ...t, date: `${y + 1}-${t.date.slice(5)}` },
  ])
  return candidates.find((t) => t.date >= fmtYMD(from)) ?? null
}

/**
 * 计算接下来 N 天内的全部事件（节气 + 公历节日 + 农历节日）
 * - type 不传则混合
 * - 含当天事件
 */
export function getUpcomingEvents(from: Date, days = 90): CalendarEvent[] {
  const out: CalendarEvent[] = []
  const end = new Date(from)
  end.setDate(end.getDate() + days)

  // 24 节气
  let cur = new Date(from)
  while (cur <= end) {
    const t = nextSolarTerm(cur)
    if (!t) break
    const [ty, tm, td] = t.date.split('-').map(Number)
    const d = new Date(ty, tm - 1, td)
    // 安全兜底：防止极端情况下取到早于当前日期的节气导致死循环
    if (d.getTime() <= cur.getTime()) break
    if (d > end) break
    out.push({ name: t.name, month: tm, day: td, type: 'solar', date: t.date })
    cur = new Date(d.getTime() + 86400000)
  }

  // 公历节日
  for (let y = from.getFullYear(); y <= end.getFullYear(); y++) {
    for (const f of SOLAR_FESTIVALS) {
      const d = new Date(y, f.month - 1, f.day)
      if (d >= from && d <= end) {
        out.push({ ...f, date: fmtYMD(d) })
      }
    }
  }

  return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
}

/**
 * 计算从 from 到 targetDate 的间隔天数（targetDate - from，向下取整，0 表示同一天）
 */
export function daysUntil(from: Date, targetDate: string): number {
  const [y, m, d] = targetDate.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  from.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - from.getTime()) / 86400000)
}

/** 友好显示某事件：今天 / 明天 / N 天后 */
export function friendlyCountdown(days: number): string {
  if (days === 0) return '今天'
  if (days === 1) return '明天'
  if (days < 0) return `${-days} 天前`
  return `${days} 天后`
}
