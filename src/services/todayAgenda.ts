import type { Task, CheckInRecord } from '@/types'
import { fmtDate } from '@/utils/date'
import { taskOccursOnDate } from '@/utils/recurrence'

export interface AgendaItem { task:Task; dateKey:string; record?:CheckInRecord; overdue:boolean }

export function buildTodayAgenda(tasks:Task[],records:CheckInRecord[],viewDate:Date,now=new Date()) {
  const day=fmtDate(viewDate),isToday=day===fmtDate(now)
  const rows:AgendaItem[]=[]
  for(const task of tasks) {
    if(task.archivedAt)continue
    const own=records.filter(record=>record.taskId===task.id)
    const single=task.recurrence==='none'||task.isQuick
    const record=single?own[0]:own.find(record=>record.date===day)
    const due=task.scheduledDate
    const scheduled=task.isQuick?!due||due===day:taskOccursOnDate(task,viewDate)
    const carry=isToday&&single&&!record&&!!due&&due<day
    const completedOnDay=single&&record&&fmtDate(new Date(record.completedAt))===day
    if(!scheduled&&!carry&&!completedOnDay)continue
    if(record&&fmtDate(new Date(record.completedAt))!==day)continue
    if(task.isQuick&&!due&&!isToday&&fmtDate(new Date(task.createdAt))>day)continue
    const dateKey=record?.date||(single&&due?due:day)
    const overdue=!record&&!!task.scheduledTime&&new Date(`${dateKey}T${task.scheduledTime}:00`).getTime()<now.getTime()
    rows.push({task,dateKey,record,overdue})
  }
  rows.sort((a,b)=>(a.task.scheduledTime||'99:99').localeCompare(b.task.scheduledTime||'99:99'))
  const completed=rows.filter(row=>row.record),pending=rows.filter(row=>!row.record)
  const overdue=pending.filter(row=>row.overdue)
  const timed=pending.filter(row=>!row.overdue&&row.task.scheduledTime)
  const next=timed[0]
  const unscheduled=pending.filter(row=>!row.task.scheduledTime)
  return {rows,pending,completed,overdue,next,scheduled:timed.slice(1),unscheduled}
}

export function habitBackground(task:Task,color?:string) {
  return task.recurrence!=='none'&&!task.isQuick&&color&&/^#[\da-f]{6}$/i.test(color)?`${color}12`:'#FFFFFF'
}
