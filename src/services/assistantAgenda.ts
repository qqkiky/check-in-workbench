import type { Task, CheckInRecord } from '@/types'
import { safeAgenda } from '../../assistant/src/dailyAgenda.mjs'
import { fmtDate } from '@/utils/date'

export function assistantAgendaItem(task:Task,records:CheckInRecord[],now=new Date()) {
  const done=records.filter(record=>record.taskId===task.id),today=fmtDate(now)
  return safeAgenda([{id:task.id,title:task.title,date:task.scheduledDate||'',time:task.scheduledTime||'',
    createdDate:fmtDate(new Date(task.createdAt)),recurrence:task.recurrence||'none',
    weekdays:task.weekdays||[],monthDay:task.monthDay||0,excludedDates:task.excludedDates||[],
    completedDates:done.map(record=>record.date).filter(day=>day>=today),completed:done.length>0}])[0]
}
export function assistantAgenda(tasks:Task[],records:CheckInRecord[],now=new Date()) {
  return safeAgenda(tasks.filter(task=>!task.archivedAt&&(task.recurrence!=='none'||!task.scheduledDate||!task.scheduledTime)).map(task=>assistantAgendaItem(task,records,now)))
}
