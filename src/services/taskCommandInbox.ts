import type { Task, CheckInRecord } from '@/types'
import { assistantAgendaItem } from './assistantAgenda'
import { effectiveAgenda } from '../../assistant/src/taskCommands.mjs'

export function applyTaskCommand(tasks:Task[],records:CheckInRecord[],command:any,now=Date.now()) {
  const current=tasks.find(task=>task.id===command?.taskId&&!task.archivedAt)
  if(!current||typeof command.id!=='string'||!/^[\w-]{1,60}$/.test(command.id)||!Number.isFinite(command.createdAt)
    ||now-command.createdAt>7*86400000||!['complete','cancel','update'].includes(command.action?.type)
    ||JSON.stringify(assistantAgendaItem(current,records,new Date(command.createdAt)))!==JSON.stringify(command.base))return false
  const projected=effectiveAgenda({agenda:{tasks:[command.base]},taskCommands:[command]})
  if(command.action.type==='complete') {
    if(!records.some(record=>record.taskId===current.id&&record.date===command.targetDate))records.unshift({id:'wxcmd-'+command.id,taskId:current.id,taskTitle:current.title,categoryId:current.categoryId,date:command.targetDate,completedAt:command.createdAt,durationSeconds:0})
  } else if(command.action.type==='cancel'&&current.recurrence==='none') {
    tasks[tasks.indexOf(current)]={...current,archivedAt:now,updatedAt:now}
  } else {
    const original=projected.find((task:any)=>task.id===current.id)
    tasks[tasks.indexOf(current)]={...current,title:original.title,scheduledDate:original.date||undefined,scheduledTime:original.time||undefined,excludedDates:original.excludedDates,updatedAt:now}
    const moved=projected.find((task:any)=>task.id!==current.id)
    if(moved&&!tasks.some(task=>task.id===moved.id))tasks.unshift({...current,id:moved.id,title:moved.title,scheduledDate:moved.date,scheduledTime:moved.time||undefined,recurrence:'none',weekdays:undefined,monthDay:undefined,excludedDates:[],isQuick:false,createdAt:now,updatedAt:now})
  }
  return true
}
