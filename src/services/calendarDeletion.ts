import type { Task } from '@/types'
import { fmtDate } from '@/utils/date'

// Calendar keys are recorded only after this APK successfully creates an event.
export function planCalendarDeletions(tasks:Task[],keys:string[],now=Date.now()) {
  const removedIds=new Set<string>(),cancelled=new Map<string,Set<string>>()
  for(const key of keys) {
    const match=/^(.+)@(\d{4}-\d{2}-\d{2})$/.exec(key)
    const id=match?.[1]||key,day=match?.[2],task=tasks.find(task=>task.id===id)
    if(!task||task.archivedAt)continue
    if(task.recurrence==='none'||task.isQuick){
      if(day&&task.scheduledDate&&day!==task.scheduledDate)continue
      removedIds.add(id);continue
    }
    if(!day||!Number.isFinite(Date.parse(day+'T00:00:00'))||fmtDate(new Date(day+'T00:00:00'))!==day)continue
    if(task.excludedDates?.includes(day))continue
    if(!cancelled.has(id))cancelled.set(id,new Set())
    cancelled.get(id)!.add(day)
  }
  const next=tasks.filter(task=>!removedIds.has(task.id)).map(task=>cancelled.has(task.id)?{...task,excludedDates:[...new Set([...(task.excludedDates||[]),...cancelled.get(task.id)!])].sort(),updatedAt:now}:task)
  return {tasks:next,removedIds:[...removedIds],cancelledOccurrences:[...cancelled.values()].reduce((sum,dates)=>sum+dates.size,0),changed:removedIds.size>0||cancelled.size>0}
}
