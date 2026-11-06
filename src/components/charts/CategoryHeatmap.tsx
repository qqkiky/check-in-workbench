import { useMemo, useState } from 'react'
import { fmtDate, dt } from '@/utils/date'
import type { Category, CheckInRecord, Task } from '@/types'
import { CategoryIcon } from '@/utils/iconLibrary'
import { taskOccursOnDate } from '@/utils/recurrence'
import { daysFrom, monthDay, REVIEW_WEEKDAYS, reviewColor, reviewGroups, weekStart } from '@/utils/review'
import { ReviewBar, ReviewEmpty, ReviewNav, ReviewSwitch } from '@/components/review/ReviewParts'
import { Icons } from '@/components/common/Icons'

const options=[{key:'week' as const,label:'周'},{key:'month' as const,label:'月'}]
type Props={records:CheckInRecord[];categories:Category[];tasks:Task[];filterCategoryId?:string;firstDay?:number}

export function CategoryHeatmap({records,categories,tasks,filterCategoryId,firstDay=1}:Props){
  const [range,setRange]=useState<'week'|'month'>('week')
  const [cursor,setCursor]=useState(()=>new Date())
  const [expanded,setExpanded]=useState<Set<string>>(new Set())
  const [openMonth,setOpenMonth]=useState<Set<string>|null>(null)
  const cats=filterCategoryId?categories.filter(c=>c.id===filterCategoryId):categories
  const week=daysFrom(weekStart(cursor,firstDay),7)
  const keys=week.map(fmtDate)
  const today=fmtDate(new Date())
  const prefix=fmtDate(cursor).slice(0,7)
  const weekData=useMemo(()=>{
    const marks=new Set<string>(),done=new Set<string>()
    for(const r of records){
      if(r.date<keys[0]||r.date>keys[6])continue
      marks.add(r.categoryId+'|'+r.date);done.add(r.taskId+'|'+r.date)
    }
    return {marks,done}
  },[records,keys[0],keys[6]])
  const monthGroups=useMemo(()=>reviewGroups(records.filter(r=>r.date.startsWith(prefix)&&(!filterCategoryId||r.categoryId===filterCategoryId)),categories),[records,categories,prefix,filterCategoryId])
  const shift=(n:number)=>{
    setCursor(d=>range==='week'?dt.addDays(d,n*7):new Date(d.getFullYear(),d.getMonth()+n,1))
    setOpenMonth(null)
  }
  function toggle(set:Set<string>,id:string){const next=new Set(set);if(next.has(id))next.delete(id);else next.add(id);return next}
  const monthOpen=openMonth??new Set(monthGroups[0]?[monthGroups[0].id]:[])
  return <>
    <ReviewNav title={range==='week'?monthDay(week[0])+' — '+monthDay(week[6]):`${cursor.getFullYear()}年${cursor.getMonth()+1}月`} onPrev={()=>shift(-1)} onNext={()=>shift(1)}/>
    <ReviewSwitch value={range} options={options} onChange={setRange}/>
    {range==='week'?<>
      <section className="rv-card">
        <div className="rv-card-heading"><h3>本周分类追踪</h3><span className="rv-muted">● 有记录</span></div>
        {cats.length?<div className="rv-category-grid" role="table" aria-label="本周各分类记录">
          <div className="rv-category-grid-row" role="row"><span role="columnheader">分类</span>{week.map((d,i)=><span role="columnheader" key={keys[i]} className={keys[i]===today?'rv-cat-today':''}><small>{REVIEW_WEEKDAYS[d.getDay()]}</small><b>{d.getDate()}</b></span>)}</div>
          {cats.map(cat=><div className="rv-category-grid-row" role="row" key={cat.id}>
            <span className="rv-cat-heading" role="rowheader" title={cat.name}><CategoryIcon category={cat} size={16} color={reviewColor(cat)} filled/><strong>{cat.name}</strong></span>
            {keys.map(key=>{const marked=weekData.marks.has(cat.id+'|'+key);return <span key={key} className="rv-category-cell" role="cell" aria-label={`${key} ${cat.name} ${marked?'有记录':'无记录'}`} style={marked?{backgroundColor:`color-mix(in srgb, ${reviewColor(cat)} 72%, #fff)`}:undefined}/>})}
          </div>)}
        </div>:<ReviewEmpty>暂无分类</ReviewEmpty>}
      </section>
      <section className="rv-card">
        <div className="rv-card-heading"><h3>分类事项完成度</h3><span className="rv-muted">已完成 / 应完成</span></div>
        {cats.map(cat=>{
          const list=tasks.filter(t=>t.categoryId===cat.id&&!t.archivedAt&&!t.isQuick).map(task=>({
            task,expected:week.filter(d=>taskOccursOnDate(task,d)).length,done:keys.filter(key=>weekData.done.has(task.id+'|'+key)).length,
          })).filter(row=>row.expected||row.done)
          const expected=list.reduce((n,row)=>n+row.expected,0),done=list.reduce((n,row)=>n+row.done,0)
          const color=reviewColor(cat)
          return <div className="rv-accordion" key={cat.id}>
            <button type="button" aria-expanded={expanded.has(cat.id)} onClick={()=>setExpanded(current=>toggle(current,cat.id))}>
              <CategoryIcon category={cat} size={20} color={color} filled/><strong>{cat.name}</strong>
              <div className="rv-completion-bar"><ReviewBar value={done} max={expected} color={color}/></div><small>{done} / {expected}</small><Icons.ChevronRight size={14}/>
            </button>
            {expanded.has(cat.id)&&<div className="rv-completion-list">{list.length?list.map(({task,expected,done})=><div key={task.id}><span>{task.title}</span><small>{done} / {expected}</small></div>):<ReviewEmpty>本周暂无可追踪的事项</ReviewEmpty>}</div>}
          </div>
        })}
        {!cats.length&&<ReviewEmpty>暂无可追踪的分类</ReviewEmpty>}
      </section>
    </>:monthGroups.length?monthGroups.map(group=><section className={'rv-card rv-achievement'+(monthOpen.has(group.id)?' rv-achievement-open':'')} style={{borderInlineStartColor:monthOpen.has(group.id)?group.color:undefined}} key={group.id}>
      <div className="rv-accordion">
        <button type="button" aria-expanded={monthOpen.has(group.id)} onClick={()=>setOpenMonth(current=>toggle(current??monthOpen,group.id))}>
          <strong>{group.name}成果</strong><small>本月共 {group.count} 次</small><Icons.ChevronRight size={14}/>
        </button>
      </div>
      {monthOpen.has(group.id)&&<div className="rv-achievement-list">{group.items.map(it=><div key={it.id}><strong>{it.name}</strong><span className="rv-muted">完成 {it.count} 次</span></div>)}</div>}
    </section>):<section className="rv-card"><ReviewEmpty>本月暂无符合筛选的打卡</ReviewEmpty></section>}
  </>
}
