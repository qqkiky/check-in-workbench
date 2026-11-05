import { useEffect, useState } from 'react'
import { readGoals, readMemories, goalProgress } from '@/services/coach'
import { dailyStatus, refreshDaily } from '@/services/coachDaily'
import { fmtDate } from '@/utils/date'
import { useStore } from '@/store'
export function DailyCoachCard({onDiscuss}:{onDiscuss:()=>void}){
 useStore(s=>s.tasks);useStore(s=>s.records)
 const [,update]=useState(0)
 useEffect(()=>{const refresh=()=>update(n=>n+1);window.addEventListener('coach-daily-updated',refresh);window.addEventListener('coach-data-saved',refresh);void refreshDaily();return()=>{window.removeEventListener('coach-daily-updated',refresh);window.removeEventListener('coach-data-saved',refresh)}},[])
 const memories=readMemories().filter(m=>m.kind==='goal'),goals=readGoals(),today=fmtDate(new Date())
 const report=dailyStatus().reports.filter(r=>r.date===today).slice(-1)[0]
 if(!memories.length)return null
 return <section className="mx-3 my-2 rounded-2xl bg-white border border-indigo-100 p-3 space-y-2">
 <div className="flex justify-between gap-2 items-center"><h2 className="text-sm font-semibold text-indigo-900">目标跟进</h2><button onClick={onDiscuss} className="text-primary text-xs py-1">继续聊</button></div>
 {report?.status==='ok'?<details className="space-y-2"><summary className="cursor-pointer text-xs text-indigo-600">{report.slot==='morning'?'查看早间计划':'查看晚间复盘'} · {new Date(report.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</summary><p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{report.text}</p>{report.question&&<button onClick={onDiscuss} className="text-left text-sm text-primary break-words">{report.question}</button>}</details>:<p className="text-xs text-gray-500">{report?.status==='running'?'AI 正在整理这次跟进。':report?'本次 AI 跟进未完成，本时段不自动重试。':'早间理清行动，晚间按真实记录复盘。首次跟进等待联网和后台调度。'}</p>}
 {goals.map(g=>{const p=goalProgress(g);return <div key={g.id} className="border-t border-gray-100 pt-2"><p className="text-sm font-medium break-words">{g.title}</p><p className="text-xs text-gray-500 mt-1">{g.deadline?'截止 '+g.deadline:'截止日期待明确'} · {p.linked?'关联 '+p.linked+' 项，已打卡 '+p.completed+' 次 / '+p.days+' 天':'尚未关联行动'}</p>{g.progress&&<p className="text-xs text-gray-500 break-words mt-1">你反馈的进度：{g.progress}</p>}</div>})}
 {memories.filter(m=>!goals.some(g=>g.sourceMemoryId===m.id)).map(m=><div key={m.id} className="text-xs text-gray-600 border-t pt-2 break-words">{m.content}<p className="text-indigo-500 mt-1">待一起明确目标、期限和下一步</p></div>)}
 </section>
}
