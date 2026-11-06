import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { fmtDate, dt } from '@/utils/date'
import { DailyTimeline } from '@/components/review/ReviewTimeline'
import { ReviewNav } from '@/components/review/ReviewParts'
import { buildReviewTimeline, localDay, monthDay, REVIEW_WEEKDAYS } from '@/utils/review'
import { TimelineNoteModal } from '@/components/timeline/TimelineNoteModal'
import { WeeklyReview } from './WeeklyReview'
import { MonthlyReview } from './MonthlyReview'
import { AnnualReview } from './AnnualReview'
import { TrendsScreen } from './TrendsScreen'
import type { TimelineEntry } from '@/types'
import { showToast } from '@/components/common/Toast'
import './review.css'

const tabs=[['day','日'],['week','周'],['month','月'],['year','年'],['tracking','追踪']] as const
type Tab=typeof tabs[number][0]

export function TimelineReviewScreen(){
  const {records,timelineEntries,categories,settings,addTimelineNote,updateTimelineEntry,deleteTimelineEntry}=useStore()
  const [tab,setTab]=useState<Tab>('day')
  const [day,setDay]=useState(()=>fmtDate(new Date()))
  const [note,setNote]=useState<{startTime:string;entry?:TimelineEntry}|null>(null)
  const d=localDay(day)
  const items=useMemo(()=>buildReviewTimeline(day,records,timelineEntries,categories),[day,records,timelineEntries,categories])
  const move=(delta:number)=>setDay(key=>fmtDate(dt.addDays(localDay(key),delta)))
  const add=()=>setNote({startTime:day===fmtDate(new Date())?dt.format(new Date(),'HH:mm'):'09:00'})
  const edit=(id:string)=>{const entry=timelineEntries.find(row=>row.id===id);if(entry)setNote({entry,startTime:entry.startTime})}
  return <div className="rv-screen">
    <header className="rv-header"><div className="rv-header-main"><h1>回顾</h1>
      {tab==='day'&&<div className="rv-nav">
        <label className="rv-date-input" title="选择日期"><Icons.Calendar size={18}/><input type="date" aria-label="选择回顾日期" value={day} onChange={e=>{if(e.target.value)setDay(e.target.value)}}/></label>
        <button type="button" aria-label="添加记事" onClick={add}><Icons.Plus size={17}/></button>
      </div>}
    </div><nav className="rv-tabs" aria-label="回顾视图">
      {tabs.map(([key,label])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}
    </nav></header>
    <div className="rv-scroll" key={tab}>
      {tab==='day'&&<div className="rv-content">
        <ReviewNav title={monthDay(d)+' · '+REVIEW_WEEKDAYS[d.getDay()]} note={`单日手记 · ${items.length} 条记录`} onPrev={()=>move(-1)} onNext={()=>move(1)}/>
        <DailyTimeline key={day} items={items} onEdit={edit} onDelete={id=>{deleteTimelineEntry(id);showToast('已删除')}}/>
      </div>}
      {tab==='week'&&<WeeklyReview/>}
      {tab==='month'&&<MonthlyReview records={records} categories={categories} entries={timelineEntries} firstDay={settings.startOfWeek}/>}
      {tab==='year'&&<AnnualReview records={records} categories={categories}/>}
      {tab==='tracking'&&<TrendsScreen/>}
    </div>
    <TimelineNoteModal open={!!note} editEntry={note?.entry??null} defaultDate={day} defaultStartTime={note?.startTime||'09:00'} categories={categories} onClose={()=>setNote(null)} onConfirm={data=>{
      if(data.id){updateTimelineEntry(data.id,{startTime:data.startTime,endTime:data.endTime,content:data.content,categoryId:data.categoryId});showToast('已更新记事')}
      else{addTimelineNote(data);showToast('已记录到时间线')}
    }}/>
  </div>
}
