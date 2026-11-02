import type { CheckInRecord, Task } from '../types'
import { taskOccursOnDate } from '../utils/recurrence'

export interface CalendarEvent {
  taskId: string
  title: string
  startMillis: number
  endMillis: number
  reminderLeadMin: number
  description: string
  completed: boolean
  reminderEnabled: boolean
  allDay?: boolean
  singleOccurrence?: boolean
}

export function buildCalendarEvents(task: Task, records: CheckInRecord[], now = new Date()): CalendarEvent[] {
  const allDay=!!task.calendarAllDay&&!task.scheduledTime
  if (task.archivedAt || (!task.scheduledTime&&!allDay)) return []
  const dates = new Set<string>()
  if (task.recurrence === 'none') {
    if (task.scheduledDate) dates.add(task.scheduledDate)
  } else {
    for (let offset = 0; offset < 14; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
      if (taskOccursOnDate(task, date)) dates.add(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`)
    }
    const cutoff = new Date(now.getFullYear(),now.getMonth(),now.getDate()-30).getTime()
    for (const record of records) if (record.taskId === task.id && new Date(`${record.date}T00:00:00`).getTime() >= cutoff) dates.add(record.date)
  }
  return [...dates].filter(date=>!task.excludedDates?.includes(date)).map(date => {
    const [year, month, day] = date.split('-').map(Number)
    const [hour, minute] = (task.scheduledTime||'00:00').split(':').map(Number)
    const start = allDay?Date.UTC(year,month-1,day):new Date(year, month - 1, day, hour, minute).getTime()
    const completed = records.some(record => record.taskId === task.id && (task.recurrence==='none'||record.date === date))
    return { taskId: `${task.id}@${date}`, title: task.title, startMillis: start,
      endMillis: start + (task.duration && task.duration > 0 ? task.duration : allDay?1440:30) * 60000,
      reminderLeadMin: task.reminderLead ?? 0, completed, reminderEnabled: !!task.reminderEnabled,
      singleOccurrence:task.recurrence==='none',...(allDay?{allDay:true}:{}),description: completed ? '已在打卡工作台完成' : '来自打卡工作台' }
  }).filter(event => Number.isFinite(event.startMillis))
}
