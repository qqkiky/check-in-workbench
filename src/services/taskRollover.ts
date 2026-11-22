import type { CheckInRecord, Task } from '@/types'
import { fmtDate } from '@/utils/date'

export function rollOverdueTasks(tasks: Task[], records: CheckInRecord[], now = new Date()) {
  const today = fmtDate(now)
  const completed = new Set(records.map(record => record.taskId))
  const changedIds: string[] = []
  const next = tasks.map(task => {
    if (task.recurrence !== 'none' || task.isQuick || task.archivedAt || completed.has(task.id) ||
        !task.scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate) || task.scheduledDate >= today) return task
    changedIds.push(task.id)
    return { ...task, scheduledDate: today, updatedAt: now.getTime() }
  })
  return { tasks: next, changedIds }
}
