import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { dt, fmtDate } from '@/utils/date'
import { buildReviewTimeline, daysFrom, monthDay, REVIEW_WEEKDAYS, timelineBounds, weekStart } from '@/utils/review'
import { ReviewNav, ReviewSwitch } from '@/components/review/ReviewParts'
import { ReviewItemList, TimeRail } from '@/components/review/ReviewTimeline'

const modes=[{key:3 as const,label:'3天'},{key:7 as const,label:'7天'}]
export function WeeklyReview() {
  const { records, timelineEntries, categories, settings }=useStore()
  const [mode,setMode]=useState<3|7>(7)
  const [anchor,setAnchor]=useState(()=>new Date())
  const [selected,setSelected]=useState(fmtDate(anchor))
  const start=mode===7?weekStart(anchor,settings.startOfWeek):dt.addDays(anchor,-2)
  const startKey=fmtDate(start)
  const dayList=useMemo(()=>daysFrom(new Date(startKey+'T00:00:00'),mode).map(d=>{
    const key=fmtDate(d)
    return {key,d,items:buildReviewTimeline(key,records,timelineEntries,categories)}
  }),[startKey,mode,records,timelineEntries,categories])
  const selectedDay=dayList.find(d=>d.key===selected)||dayList[mode-1]
  const bounds=timelineBounds(dayList.flatMap(d=>d.items))
  const countDigits=String(Math.max(...dayList.map(day=>day.items.length))).length
  const columns={gridTemplateColumns:`49px minmax(0,1fr) max(30px, calc(${countDigits}ch + 18px))`}
  const shift=(step:number)=>{
    const next=dt.addDays(anchor,step*mode)
    setAnchor(next);setSelected(fmtDate(next))
  }
  return <div className="rv-content">
    <ReviewNav title={monthDay(dayList[0].d)+' — '+monthDay(dayList[mode-1].d)} note={`${mode===7?'七日周览':'三日手记'} · ${dayList.reduce((sum,d)=>sum+d.items.length,0)} 条记录`} onPrev={()=>shift(-1)} onNext={()=>shift(1)}/>
    <div className="rv-tools rv-align-end"><ReviewSwitch value={mode} options={modes} onChange={setMode}/></div>
    {mode===3?[...dayList].reverse().map(day=><section className="rv-card" key={day.key}>
      <div className="rv-card-heading"><h3>{monthDay(day.d)} <small>{REVIEW_WEEKDAYS[day.d.getDay()]}</small></h3><span className="rv-muted">{day.items.length} 条记录</span></div>
      <TimeRail items={day.items} bounds={bounds}/>
      <ReviewItemList items={day.items}/>
    </section>):<>
      <section className="rv-card">
        <div className="rv-card-heading"><h3>七天时段</h3><span className="rv-muted">点日期看当天</span></div>
        <div className="rv-week-scale" style={columns}><TimeRail items={[]} bounds={bounds}/></div>
        {dayList.map(day=><button type="button" className="rv-week-row" style={columns} key={day.key} aria-pressed={selectedDay.key===day.key} onClick={()=>setSelected(day.key)}>
          <span className="rv-week-label">{day.d.getDate()} <small>{REVIEW_WEEKDAYS[day.d.getDay()]}</small></span>
          <TimeRail items={day.items} bounds={bounds} showTicks={false}/>
          <span className="rv-muted">{day.items.length} 条</span>
        </button>)}
      </section>
      <section className="rv-card">
        <div className="rv-card-heading"><h3>{monthDay(selectedDay.d)} · {REVIEW_WEEKDAYS[selectedDay.d.getDay()]}</h3><span className="rv-muted">{selectedDay.items.length} 条记录</span></div>
        <ReviewItemList items={selectedDay.items}/>
      </section>
    </>}
  </div>
}
