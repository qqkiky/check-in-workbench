import type { CheckInRecord, Category, TimelineEntry } from '@/types'
import { dt } from '@/utils/date'

export interface DayTimelineItem {
  type: 'checkin' | 'note'
  id: string
  time: string // 展示用开始时间 HH:mm
  endTime?: string
  color: string
  catName?: string
  title?: string // checkin 任务名
  content?: string // note 内容
  dur: number // 时长（秒）
  isMakeup?: boolean
}

function diffMinutes(start?: string, end?: string): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null
  let diff = eh * 60 + em - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60 // 跨天：结束时间视作次日
  return diff // 0 表示同一分钟内完成
}

// 时间线记事总时长（秒）：基于起止 HH:mm，支持跨天，同分钟为 0
export function timelineDurationSeconds(start?: string, end?: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0
  let diffMin = eh * 60 + em - (sh * 60 + sm)
  if (diffMin < 0) diffMin += 24 * 60
  return diffMin * 60
}

export function noteDiffMinutes(start?: string, end?: string): number | null {
  return diffMinutes(start, end)
}

/**
 * 合并某天的「打卡记录」与「手动记事」，按时间排序，供时间线 / 每周复盘复用。
 */
export function buildDayTimeline(
  dateKey: string,
  records: CheckInRecord[],
  entries: TimelineEntry[],
  categories: Category[]
): DayTimelineItem[] {
  const catOf = (id?: string) => categories.find((c) => c.id === id)
  const dayRecords = records.filter((r) => r.date === dateKey)
  const dayEntries = entries.filter((e) => e.date === dateKey)

  const items: DayTimelineItem[] = [
    ...dayRecords.map<DayTimelineItem>((r) => {
      const cat = catOf(r.categoryId)
      const startT = r.startedAt
        ? dt.format(new Date(r.startedAt), 'HH:mm')
        : dt.format(new Date(r.completedAt), 'HH:mm')
      return {
        type: 'checkin',
        id: r.id,
        time: startT,
        color: cat?.color || '#34C759',
        catName: cat?.name,
        title: r.taskTitle,
        dur: r.durationSeconds || 0,
        isMakeup: r.isMakeup,
      }
    }),
    ...dayEntries.map<DayTimelineItem>((e) => {
      const cat = catOf(e.categoryId)
      return {
        type: 'note',
        id: e.id,
        time: e.startTime,
        endTime: e.endTime,
        color: cat?.color || '#8E8E93',
        catName: cat?.name,
        content: e.content,
        dur: 0,
      }
    }),
  ].sort((a, b) => a.time.localeCompare(b.time))

  return items
}
