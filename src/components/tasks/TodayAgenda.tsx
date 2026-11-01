import { useState } from 'react'
import type { Category } from '@/types'
import { type AgendaItem, habitBackground } from '@/services/todayAgenda'
import { recurrenceShortLabel } from '@/utils/recurrence'
import { Icons } from '@/components/common/Icons'
import { fmtDate } from '@/utils/date'

export function TodayAgenda({agenda,categories,compact,onCheckIn,onEdit,onAdd}:{
  agenda:ReturnType<typeof import('@/services/todayAgenda').buildTodayAgenda>;categories:Category[];compact:boolean
  onCheckIn:(id:string,done:boolean,dateKey:string)=>void;onEdit:(id:string)=>void;onAdd:()=>void
}) {
  const [showDone,setShowDone]=useState(false)
  function row(item:AgendaItem,next=false) {
    const {task,record,overdue,dateKey}=item,category=categories.find(category=>category.id===task.categoryId)
    const recurrence=recurrenceShortLabel(task)
    const completionLabel=record?`${fmtDate(new Date(record.completedAt))!==dateKey?fmtDate(new Date(record.completedAt)).slice(5)+' ':''}${new Date(record.completedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}`:''
    return <div key={`${task.id}@${dateKey}`} data-task-id={task.id} data-occurrence={dateKey} className={`agenda-task ${overdue?'is-overdue':next?'is-next':''} ${record?'is-done':''}`} style={{backgroundColor:habitBackground(task,category?.color)}}>
      <button type="button" onClick={()=>onEdit(task.id)} className="agenda-task-content" aria-label={`编辑任务：${task.title}`}>
        <span className="agenda-task-time">{overdue&&compact?'逾期':task.scheduledTime||'时间待定'}</span>
        <span className="min-w-0 flex-1">
          <span className="agenda-task-title">{task.title}</span>
          {!compact&&<span className="agenda-task-meta">{record?`完成于 ${completionLabel}`:[recurrence,category?.name].filter(Boolean).join(' · ')||'临时事项'}{!record&&task.target?` · 目标 ${task.target}${task.unit||''}`:''}</span>}
        </span>
        {overdue&&!compact&&<span className="agenda-badge">逾期</span>}
        {task.priority==='high'&&!overdue&&<span className="text-xs text-orange-600 shrink-0">重要</span>}
      </button>
      <button type="button" className={`agenda-check ${record?'checked':''}`} aria-label={`${record?'取消完成':'标记完成'}：${task.title}`} onClick={()=>onCheckIn(task.id,!!record,dateKey)}>{record&&<Icons.Check size={17}/>}</button>
    </div>
  }
  function section(title:string,items:AgendaItem[]) {
    return items.length>0&&<section className="agenda-section" aria-label={title}>{!compact&&<h2>{title}</h2>}<div className="space-y-2">{items.map(item=>row(item))}</div></section>
  }
  return <>
    <div className="agenda-summary" aria-label="待办概览"><span>还剩 <strong>{agenda.pending.length}</strong> 项</span><span>逾期 <strong className="text-red-600">{agenda.overdue.length}</strong></span><span className="agenda-summary-done">已完成 <strong className="text-green-600">{agenda.completed.length}</strong></span></div>
    {!compact&&agenda.next&&<section className="agenda-section" aria-label="接下来做"><h2>接下来做</h2>{row(agenda.next,true)}</section>}
    {section('逾期待办',agenda.overdue)}
    {compact&&agenda.next&&<section className="agenda-section" aria-label="接下来做">{row(agenda.next,true)}</section>}
    {section('其他待办',agenda.scheduled)}
    {section('待安排',agenda.unscheduled)}
    {agenda.pending.length===0&&<div className="agenda-empty"><Icons.Check size={28}/><p>{agenda.completed.length?'这一天的事项都完成了':'这一天还没有待办'}</p><button onClick={onAdd} className="text-primary text-sm py-2">添加事项</button></div>}
    {agenda.completed.length>0&&<section className="agenda-completed"><button className="flex items-center gap-2 text-sm text-gray-500 py-3" aria-expanded={showDone} onClick={()=>setShowDone(!showDone)}><span>{showDone?'⌃':'⌄'}</span>已完成 {agenda.completed.length} 项</button>{showDone&&<div className="space-y-2">{agenda.completed.map(item=>row(item))}</div>}</section>}
  </>
}
