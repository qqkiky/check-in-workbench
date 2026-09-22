// 日期工具 - 不依赖第三方库

export const DATE_FORMAT = 'yyyy-MM-dd'

const ZH_CN_WEEKDAYS = [
  '周日', '周一', '周二', '周三', '周四', '周五', '周六',
]
const ZH_CN_WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toDate(d: Date | string | number): Date {
  if (typeof d === 'string') {
    // YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split('-').map(Number)
      return new Date(y, m - 1, day)
    }
    return new Date(d)
  }
  if (typeof d === 'number') return new Date(d)
  return d
}

export function fmtDate(d: Date | string | number): string {
  const date = toDate(d)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayStr(): string {
  return fmtDate(new Date())
}

export const dt = {
  startOfDay: (d: Date) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  },
  endOfDay: (d: Date) => {
    const x = new Date(d)
    x.setHours(23, 59, 59, 999)
    return x
  },
  startOfWeek: (d: Date, weekStartsOn: 0 | 1 = 1) => {
    const x = new Date(d)
    const dow = x.getDay()
    const diff = (dow < weekStartsOn ? 7 : 0) + dow - weekStartsOn
    x.setDate(x.getDate() - diff)
    x.setHours(0, 0, 0, 0)
    return x
  },
  endOfWeek: (d: Date, weekStartsOn: 0 | 1 = 1) => {
    const x = dt.startOfWeek(d, weekStartsOn)
    x.setDate(x.getDate() + 6)
    x.setHours(23, 59, 59, 999)
    return x
  },
  startOfMonth: (d: Date) => {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
  },
  endOfMonth: (d: Date) => {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  },
  addDays: (d: Date, n: number) => {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
  },
  subDays: (d: Date, n: number) => {
    return dt.addDays(d, -n)
  },
  differenceInDays: (a: Date, b: Date) => {
    return Math.round((dt.startOfDay(a).getTime() - dt.startOfDay(b).getTime()) / 86400000)
  },
  differenceInSeconds: (a: Date, b: Date) => {
    return Math.round((a.getTime() - b.getTime()) / 1000)
  },
  isSameDay: (a: Date, b: Date) => fmtDate(a) === fmtDate(b),
  isToday: (d: Date) => fmtDate(d) === fmtDate(new Date()),
  isYesterday: (d: Date) => fmtDate(d) === fmtDate(dt.subDays(new Date(), 1)),
  isTomorrow: (d: Date) => fmtDate(d) === fmtDate(dt.addDays(new Date(), 1)),
  eachDayOfInterval: ({ start, end }: { start: Date; end: Date }) => {
    const days: Date[] = []
    let cur = dt.startOfDay(start)
    const last = dt.startOfDay(end)
    while (cur <= last) {
      days.push(new Date(cur))
      cur = dt.addDays(cur, 1)
    }
    return days
  },
  getDay: (d: Date) => d.getDay(),
  getDate: (d: Date) => d.getDate(),
  getMonth: (d: Date) => d.getMonth(),
  getYear: (d: Date) => d.getFullYear(),
  format: (d: Date | string | number, p: string) => {
    const date = toDate(d)
    // 支持常用格式
    return p
      .replace(/yyyy/g, String(date.getFullYear()))
      .replace(/MM/g, pad(date.getMonth() + 1))
      .replace(/M/g, String(date.getMonth() + 1))
      .replace(/dd/g, pad(date.getDate()))
      .replace(/d/g, String(date.getDate()))
      .replace(/HH/g, pad(date.getHours()))
      .replace(/mm/g, pad(date.getMinutes()))
      .replace(/ss/g, pad(date.getSeconds()))
      .replace(/EEEE/g, ZH_CN_WEEKDAYS[date.getDay()])
      .replace(/EE/g, ZH_CN_WEEKDAYS_SHORT[date.getDay()])
  },
}

export function secondsToHuman(seconds: number): string {
  if (!seconds || seconds < 0) return '00m00s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h${pad(m)}m${pad(s)}s`
  return `${pad(m)}m${pad(s)}s`
}

export function secondsToCompact(seconds: number): string {
  if (!seconds || seconds < 0) return '0'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function friendlyDate(d: Date | string): string {
  const date = typeof d === 'string' ? toDate(d) : d
  if (dt.isToday(date)) return '今天'
  if (dt.isYesterday(date)) return '昨天'
  if (dt.isTomorrow(date)) return '明天'
  return `${date.getMonth() + 1}月${date.getDate()}日 ${ZH_CN_WEEKDAYS[date.getDay()]}`
}

export function weekdayLabels(startOfWeek: 0 | 1 = 1): string[] {
  if (startOfWeek === 1) {
    return ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  }
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return dt.eachDayOfInterval({ start, end })
}

// 农历数据（1900-2100）
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x0d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63,
]

function lYearDays(y: number): number {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    if ((LUNAR_INFO[y - 1900] & i) !== 0) sum += 1
  }
  return sum + leapDays(y)
}

function leapMonth(y: number): number {
  return LUNAR_INFO[y - 1900] & 0xf
}

function leapDays(y: number): number {
  if (leapMonth(y) === 0) return 0
  return (LUNAR_INFO[y - 1900] & 0x10000) !== 0 ? 30 : 29
}

function monthDays(y: number, m: number): number {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) !== 0 ? 30 : 29
}

function toLunar(date: Date): { year: string; month: string; day: string } {
  let offset = Math.floor((date.getTime() - new Date(1900, 0, 31).getTime()) / 86400000)
  let lunarYear = 1900
  let temp = 0
  for (; lunarYear < 2100 && offset > 0; lunarYear++) {
    temp = lYearDays(lunarYear)
    if (offset < temp) break
    offset -= temp
  }
  const leap = leapMonth(lunarYear)
  let isLeap = false
  let lunarMonth = 1
  for (; lunarMonth < 13 && offset >= 0; lunarMonth++) {
    if (leap > 0 && lunarMonth === leap + 1 && !isLeap) {
      lunarMonth--
      isLeap = true
      temp = leapDays(lunarYear)
    } else {
      temp = monthDays(lunarYear, lunarMonth)
    }
    if (isLeap && lunarMonth === leap + 1) isLeap = false
    if (offset < temp) break
    offset -= temp
  }
  const lunarDay = offset + 1
  const monthCN = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
  const dayCN = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
  ]
  const yearCN = (y: number) => {
    const tian = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
    const di = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    return tian[(y - 4) % 10] + di[(y - 4) % 12]
  }
  const monthName = (isLeap ? '闰' : '') + monthCN[lunarMonth - 1] + '月'
  const dayName = lunarDay === 1 ? monthName : dayCN[lunarDay - 1]
  return {
    year: yearCN(lunarYear) + '年',
    month: monthName,
    day: dayName,
  }
}

export function getLunarDay(date: Date): string {
  try {
    return toLunar(date).day
  } catch {
    return ''
  }
}

export function getLunarMonth(date: Date): string {
  try {
    return toLunar(date).month
  } catch {
    return ''
  }
}

