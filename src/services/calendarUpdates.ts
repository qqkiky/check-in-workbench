import type { Task, CheckInRecord } from '@/types'
import { fmtDate } from '@/utils/date'

export interface CalendarUpdate {key:string;eventId:number;title:string;startMillis:number;endMillis:number;allDay?:boolean;isNew?:boolean;reminderEnabled?:boolean;reminderLeadMin?:number}
export function planCalendarUpdates(tasks:Task[],records:CheckInRecord[],changes:CalendarUpdate[],preferredIds=new Set<string>(),now=Date.now()) {
  let next=[...tasks]
  let nextRecords=[...records]
  const rebindings:{fromKey:string;toKey:string;eventId:number}[]=[]
  let changed=0,imported=0
  for(const change of changes) {
    const match=/^(.+)@(\d{4}-\d{2}-\d{2})$/.exec(change.key)
    if(!match||preferredIds.has(match[1])||!Number.isSafeInteger(change.eventId)||change.eventId<=0||typeof change.title!=='string'||!Number.isFinite(change.startMillis)||!Number.isFinite(change.endMillis)||change.endMillis<=change.startMillis||!change.title.trim())continue
    let task=next.find(task=>task.id===match[1])
    if(task?.archivedAt)continue
    const date=change.allDay?new Date(change.startMillis).toISOString().slice(0,10):fmtDate(new Date(change.startMillis)),start=new Date(change.startMillis)
    const time=`${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`
    if(!task){
      if(!change.isNew)continue
      task={id:match[1],title:change.title.trim(),categoryId:'work',recurrence:'none',scheduledDate:date,scheduledTime:change.allDay?undefined:time,
        calendarAllDay:!!change.allDay,duration:Math.max(1,Math.round((change.endMillis-change.startMillis)/60000)),
        reminderEnabled:!!change.reminderEnabled,reminderLead:change.reminderLeadMin||0,createdAt:now,updatedAt:now}
      next.unshift(task);changed++;imported++;continue
    }
    const completed=records.some(record=>record.taskId===task.id&&record.date===match[2])
    const title=completed?change.title.replace(/^✅ 已完成｜/,'').trim():change.title.trim()
    if(!title)continue
    const patch={title,scheduledDate:date,scheduledTime:change.allDay?undefined:time,calendarAllDay:!!change.allDay,duration:Math.max(1,Math.round((change.endMillis-change.startMillis)/60000)),
      ...(change.reminderEnabled===undefined?{}:{reminderEnabled:change.reminderEnabled,reminderLead:change.reminderLeadMin||0}),updatedAt:now}
    let id=task.id
    if(task.recurrence!=='none'&&!task.isQuick) {
      id=`cal-${change.eventId}-${match[2]}`
      next=next.map(row=>row.id===task.id?{...row,excludedDates:[...new Set([...(row.excludedDates||[]),match[2]])].sort(),updatedAt:now}:row)
      next.unshift({...task,...patch,id,recurrence:'none',weekdays:undefined,monthDay:undefined,excludedDates:undefined,createdAt:now})
      nextRecords=nextRecords.map(record=>record.taskId===task.id&&record.date===match[2]?{...record,taskId:id}:record)
    }else next=next.map(row=>row.id===task.id?{...row,...patch}:row)
    const toKey=`${id}@${date}`
    if(toKey!==change.key)rebindings.push({fromKey:change.key,toKey,eventId:change.eventId})
    changed++
  }
  return {tasks:next,records:nextRecords,rebindings,changed,imported}
}
