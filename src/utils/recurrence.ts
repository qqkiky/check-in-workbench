import type { Task } from '@/types'
import { fmtDate } from '@/utils/date'

const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 任务在指定日期是否应当出现（用于日视图 / 选择器 / 提醒引擎统一判断）。
 * - daily：每天
 * - weekly：命中 weekdays
 * - monthly：命中 monthDay（当月几号）
 * - none（一次性）：有 scheduledDate 则仅当天，否则每天（兼容旧行为）
 */
export function taskOccursOnDate(task: Task, date: Date): boolean {
  if (task.archivedAt || task.isQuick) return false
  const dow = date.getDay()
  switch (task.recurrence) {
    case 'daily':
      return true
    case 'weekly':
      return !task.weekdays || task.weekdays.length === 0 || task.weekdays.includes(dow)
    case 'monthly':
      return task.monthDay === date.getDate()
    case 'none':
    default:
      return task.scheduledDate ? fmtDate(date) === task.scheduledDate : true
  }
}

/** 列表/卡片上展示的重复短标签，没有则返回 null。 */
export function recurrenceShortLabel(task: Task): string | null {
  switch (task.recurrence) {
    case 'daily':
      return '每日'
    case 'weekly': {
      if (task.weekdays && task.weekdays.length > 0) {
        // 整周 → 简写为「每周」
        if (task.weekdays.length === 7) return '每周'
        const s = [...task.weekdays].sort().map((d) => WEEKDAY_SHORT[d]).join('')
        return `周${s}`
      }
      return '每周'
    }
    case 'monthly':
      return task.monthDay ? `每月${task.monthDay}号` : '每月'
    case 'none':
    default:
      return null
  }
}
