import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { fmtDate, dt, getLunarDay } from '@/utils/date'
import { calendarCounts, localDay, mondayPadding, monthDay, monthDays, reviewColor, REVIEW_WEEKDAYS } from '@/utils/review'
import { CategoryHeatmap } from '@/components/charts/CategoryHeatmap'
import { ReviewCategoryFilter, ReviewEmpty, ReviewNav, ReviewSwitch } from '@/components/review/ReviewParts'

const tabs=[{key:'category' as const,label:'分类追踪'},{key:'heat' as const,label:'日历热力'}]
const periods=[{key:'year' as const,label:'年'},{key:'month' as const,label:'月'}]
const weekdays=['一','二','三','四','五','六','日']
const shade=(n:number,max:number,color:string)=>n?`color-mix(in srgb, ${color} ${22+56*n/max}%, #f6f5f0)`:undefined

export function TrendsScreen(){
  const {records,categories,tasks,settings}=useStore()
  const [tab,setTab]=useState<'category'|'heat'>('category')
  const [filter,setFilter]=useState('')
  const [period,setPeriod]=useState<'year'|'month'>('year')
  const [cursor,setCursor]=useState(()=>new Date())
  const [selected,setSelected]=useState<string|null>(null)
  const today=fmtDate(new Date())
  const year=cursor.getFullYear(),month=cursor.getMonth()
  const category=categories.find(c=>c.id===filter)
  const color=category?reviewColor(category):'#72977B'
  const months=useMemo(()=>Array.from({length:12},(_,i)=>monthDays(year,i)),[year])
  const filtered=useMemo(()=>records.filter(r=>r.date.startsWith(year+'-')&&(!filter||r.categoryId===filter)),[records,year,filter])
  const counts=useMemo(()=>calendarCounts(filtered),[filtered])
  const max=Math.max(1,...counts.values())
  const active=period==='year'?counts.size:months[month].filter(d=>counts.has(fmtDate(d))).length
  const detail=selected?filtered.filter(r=>r.date===selected).sort((a,b)=>a.completedAt-b.completedAt):[]
  const move=(offset:number)=>{
    setSelected(null)
    setCursor(d=>period==='year'?new Date(d.getFullYear()+offset,d.getMonth(),1):new Date(d.getFullYear(),d.getMonth()+offset,1))
  }
  const label=(key:string,n:number)=>`${key}，${n} 次打卡`
  return <div className={'rv-content'+(tab==='heat'&&period==='year'?' rv-heat-year':'')}>
    <div className="rv-tools rv-tracking-tools">
      <ReviewSwitch value={tab} options={tabs} onChange={value=>{setTab(value);setSelected(null)}}/>
      <ReviewCategoryFilter categories={categories} value={filter} onChange={value=>{setFilter(value);setSelected(null)}}/>
    </div>
    {tab==='category'?<CategoryHeatmap records={records} categories={categories} tasks={tasks} filterCategoryId={filter||undefined} firstDay={settings.startOfWeek}/>:<>
      <div className="rv-heat-controls">
        <ReviewNav title={period==='year'?`${year} 年`:`${year}年${month+1}月`} onPrev={()=>move(-1)} onNext={()=>move(1)}/>
        <ReviewSwitch value={period} options={periods} onChange={value=>{setPeriod(value);setSelected(null)}}/>
      </div>
      <p className="rv-muted rv-heat-summary">{period==='year'?'这一年':'这个月'}有 {active} 天留下了记录</p>
      {period==='year'?<>
        <div className="rv-heat-mosaic" aria-label="年度热力 12 个月">
          {months.map((days,i)=><button type="button" className="rv-mini-month" key={i} aria-label={`${i+1}月，${days.filter(d=>counts.has(fmtDate(d))).length} 天有记录`} onClick={()=>{setCursor(new Date(year,i,1));setPeriod('month');setSelected(null)}}>
            <strong>{i+1} 月</strong>
            <span className="rv-mini-grid">
              {Array.from({length:mondayPadding(days[0])},(_,pad)=><span key={'blank'+pad}/>)}
              {days.map(d=>{const key=fmtDate(d),n=counts.get(key)||0;return <i key={key} title={label(key,n)} style={{backgroundColor:shade(n,max,color)}}/>})}
            </span>
          </button>)}
        </div>
        <div className="rv-heat-legend rv-muted"><span>一小格 = 一天</span><span>少 {[0,.23,.52,1].map(n=><i key={n} style={{backgroundColor:shade(n,1,color)}}/>)} 多</span></div>
      </>:<>
        <section className="rv-card rv-month-heat" aria-label="月度热力">
          <div className="rv-heat-month-grid">
            {weekdays.map(w=><span className="rv-muted" key={w}>{w}</span>)}
            {Array.from({length:mondayPadding(months[month][0])},(_,i)=><span key={'blank'+i}/>)}
            {months[month].map(d=>{const key=fmtDate(d),n=counts.get(key)||0;return <button type="button" key={key} aria-label={label(key,n)} aria-pressed={selected===key} className={key===today?'rv-heat-today':''} style={{backgroundColor:shade(n,max,color)}} onClick={()=>setSelected(key)}>
              <strong>{d.getDate()}</strong>{n>0&&<small>{n} 次</small>}
            </button>})}
          </div>
        </section>
        {selected&&<section className="rv-card" aria-label="当天打卡">
          <div className="rv-card-heading"><h3>{monthDay(localDay(selected))} · {REVIEW_WEEKDAYS[localDay(selected).getDay()]} {settings.showLunar&&<small>{getLunarDay(localDay(selected))}</small>}</h3><span className="rv-muted">{detail.length} 次打卡</span></div>
          {detail.length?<div className="rv-item-list">{detail.map(r=><div className="rv-item" key={r.id}>
            <span className="rv-item-dot" style={{background:reviewColor(categories.find(c=>c.id===r.categoryId))}}/>
            <span className="rv-item-time">{dt.format(new Date(r.startedAt??r.completedAt),'HH:mm')}</span><div className="rv-item-name"><strong>{r.taskTitle}</strong></div>
          </div>)}</div>:<ReviewEmpty>这一天没有符合筛选的打卡</ReviewEmpty>}
        </section>}
      </>}
    </>}
  </div>
}
