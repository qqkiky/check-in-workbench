import { useMemo, useState } from 'react'
import type { CheckInRecord, Category } from '@/types'
import { Icons } from '@/components/common/Icons'
import { reviewGroups } from '@/utils/review'
import { ReviewEmpty, ReviewNav } from '@/components/review/ReviewParts'
import { durationText } from './MonthlyReview'

export function AnnualReview({records,categories}:{records:CheckInRecord[];categories:Category[]}){
  const [year,setYear]=useState(()=>new Date().getFullYear())
  const [month,setMonth]=useState(()=>new Date().getMonth())
  const [opened,setOpened]=useState<string|null>(null)
  const yearRecords=useMemo(()=>records.filter(r=>r.date.startsWith(year+'-')),[records,year])
  const groups=useMemo(()=>reviewGroups(yearRecords,categories),[yearRecords,categories])
  const counts=Array<number>(12).fill(0)
  yearRecords.forEach(r=>{const i=Number(r.date.slice(5,7))-1;if(i>=0&&i<12)counts[i]++})
  const max=Math.max(1,...counts)
  return <div className="rv-content">
    <ReviewNav title={`${year} 年度盘点`} note="全年记录随月份回看" onPrev={()=>{setYear(y=>y-1);setOpened(null)}} onNext={()=>{setYear(y=>y+1);setOpened(null)}}/>
    <section className="rv-card">
      <span className="rv-muted">年度打卡</span>
      <div className="rv-metric-row"><strong>{yearRecords.length} 次</strong></div>
      <div className="rv-year-bars" aria-label="本年每月打卡次数">
        {counts.map((count,i)=><button type="button" key={i} aria-pressed={month===i} aria-label={`${i+1}月 ${count}次`} onClick={()=>setMonth(i)}>
          <span className="rv-year-bar-track"><i style={{height:count?Math.max(3,count/max*100)+'%':'2px'}} className={count?'':'rv-year-bar-empty'}/></span><span>{i+1}</span>
        </button>)}
      </div>
      <p className="rv-highlight">{month+1} 月 · {counts[month]} 次打卡</p>
    </section>
    <section className="rv-card">
      <h3>年度分类累计</h3>
      {groups.length?groups.map(g=><div key={g.id} className="rv-accordion">
        <button type="button" aria-expanded={opened===g.id} onClick={()=>setOpened(id=>id===g.id?null:g.id)}>
          <span className="rv-category-mark" style={{background:g.color}}/><strong>{g.name}</strong>
          <small>{g.count} 次 · {durationText(g.seconds)}</small><Icons.ChevronRight size={14}/>
        </button>
        {opened===g.id&&<div className="rv-table">
          <div className="rv-muted"><span>事项</span><span>年度时长</span><span>完成次数</span></div>
          {g.items.map(it=><div key={it.id}><strong>{it.name}</strong><span>{durationText(it.seconds)}</span><span>{it.count} 次</span></div>)}
        </div>}
      </div>):<ReviewEmpty>今年还没有打卡记录</ReviewEmpty>}
    </section>
  </div>
}
