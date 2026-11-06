import { useMemo, useState } from 'react'
import type { CheckInRecord, Category, TimelineEntry } from '@/types'
import { fmtDate } from '@/utils/date'
import { monthDay, monthlyInvestment, reviewColor, reviewGroups } from '@/utils/review'
import { timelineDurationSeconds } from '@/utils/timeline'
import { ReviewBar, ReviewCategoryFilter, ReviewEmpty, ReviewNav } from '@/components/review/ReviewParts'

export function MonthlyReview({records,categories,entries,firstDay=1}:{records:CheckInRecord[];categories:Category[];entries:TimelineEntry[];firstDay?:number}){
  const [cursor,setCursor]=useState(()=>new Date())
  const [filter,setFilter]=useState('')
  const year=cursor.getFullYear(),month=cursor.getMonth(),prefix=fmtDate(new Date(year,month,1)).slice(0,7)
  const shift=(offset:number)=>setCursor(d=>new Date(d.getFullYear(),d.getMonth()+offset,1))
  const stats=useMemo(()=>{
    const checked=records.filter(r=>r.date.startsWith(prefix)),notes=entries.filter(e=>e.date.startsWith(prefix))
    const groups=new Map(reviewGroups(checked,categories).map(g=>[g.id,{id:g.id,name:g.name,color:g.color,seconds:g.seconds}]))
    for(const e of notes){
      const seconds=timelineDurationSeconds(e.startTime,e.endTime)
      if(seconds===0)continue
      const id=e.categoryId||'__uncategorized_note'
      const category=categories.find(c=>c.id===id)
      const g=groups.get(id)||{id,name:category?.name||'未分类记事',color:reviewColor(category),seconds:0}
      g.seconds+=seconds;groups.set(id,g)
    }
    const active=new Set([...checked,...notes].map(row=>row.date)).size
    return {active,groups:[...groups.values()].filter(g=>g.seconds>0).sort((a,b)=>b.seconds-a.seconds),seconds:[...groups.values()].reduce((n,g)=>n+g.seconds,0)}
  },[records,entries,categories,prefix])
  const weeks=useMemo(()=>monthlyInvestment(records,entries,year,month,filter,firstDay),[records,entries,year,month,filter,firstDay])
  const max=Math.max(0,...weeks.map(w=>w.seconds))
  const today=fmtDate(new Date())
  const category=categories.find(c=>c.id===filter)
  return <div className="rv-content">
    <ReviewNav title={`${year}年${month+1}月`} note={prefix===today.slice(0,7)?'统计至 '+monthDay(new Date()):'月度复盘'} onPrev={()=>shift(-1)} onNext={()=>shift(1)}/>
    <section className="rv-card">
      <span className="rv-muted">本月记录时长</span>
      <div className="rv-metric-row"><strong>{durationText(stats.seconds)}</strong><span>活跃 {stats.active} 天</span></div>
    </section>
    <section className="rv-card">
      <div className="rv-card-heading"><h3>时间分布</h3><span className="rv-muted">打卡与记事</span></div>
      {stats.groups.length?stats.groups.map(g=><div className="rv-stat-row" key={g.id}>
        <div><strong>{g.name}</strong><span>{durationText(g.seconds)}</span></div>
        <ReviewBar value={g.seconds} max={stats.seconds} color={g.color}/>
      </div>):<ReviewEmpty>本月暂无带时长的记录</ReviewEmpty>}
    </section>
    <section className="rv-card">
      <div className="rv-card-heading"><h3>每周投入</h3><ReviewCategoryFilter categories={categories} value={filter} onChange={setFilter} label="每周投入分类"/></div>
      <p className="rv-muted">{category?category.name+' · 记录时长':'全部分类 · 记录时长'}</p>
      {weeks.map(w=><div className="rv-investment" key={fmtDate(w.start)}>
        <span>{w.start.getMonth()+1}/{w.start.getDate()}{w.end.getDate()!==w.start.getDate()?'–'+(w.end.getMonth()+1)+'/'+w.end.getDate():''}</span>
        <ReviewBar value={w.seconds} max={max} color={category?reviewColor(category):'#83A38B'}/>
        <strong>{!w.seconds&&fmtDate(w.start)>today?'未开始':durationText(w.seconds)}</strong>
      </div>)}
    </section>
  </div>
}

export function durationText(seconds:number){
  const mins=Math.floor(seconds/60),hours=Math.floor(mins/60)
  if(hours)return hours+'小时'+(mins%60?(mins%60)+'分':'')
  if(mins)return mins+'分钟'
  return seconds>0?Math.round(seconds)+'秒':'0分钟'
}
