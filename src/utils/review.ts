import type { Category, CheckInRecord, TimelineEntry } from '@/types'
import { dt, fmtDate } from './date'
import { buildDayTimeline, timelineDurationSeconds, type DayTimelineItem } from './timeline'

export const REVIEW_WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六']
export const monthDay = (d: Date) => `${d.getMonth()+1}月${d.getDate()}日`
export const localDay = (key: string) => new Date(key+'T00:00:00')
export const weekStart = (d: Date, first = 1) => dt.addDays(new Date(d.getFullYear(),d.getMonth(),d.getDate()),-(d.getDay()-first+7)%7)
export const daysFrom = (d: Date, count: number) => Array.from({length:count},(_,i)=>dt.addDays(d,i))
export const monthDays = (year: number, month: number) => daysFrom(new Date(year,month,1),new Date(year,month+1,0).getDate())
export const mondayPadding = (d: Date) => (d.getDay()+6)%7
export const recordDuration = (r: CheckInRecord) => Math.max(0,Number(r.durationSeconds)||0)
export const taskName = (r:CheckInRecord) => r.taskTitle?.trim() || '未命名事项'

export function reviewColor(category?: Pick<Category,'id'|'color'>) {
  if(!category)return '#89918A'
  const legacy:Record<string,string>={'#ff3b30':'#D98179','#34c759':'#70A98B','#ff9500':'#C59761','#af52de':'#A392C8','#5ac8fa':'#80A3BE','#ffcc00':'#C9AD6D','#ff2d55':'#C7899A'}
  const hex=category.color?.toLowerCase()
  return legacy[hex] || (/^#[0-9a-f]{6}$/.test(hex)?hex:'#89918A')
}

export function calendarCounts(records:CheckInRecord[]) {
  const counts=new Map<string,number>()
  for(const r of records)counts.set(r.date,(counts.get(r.date)||0)+1)
  return counts
}

export function reviewGroups(records:CheckInRecord[],categories:Category[]) {
  const byCategory=new Map<string,{id:string;name:string;color:string;count:number;seconds:number;items:Map<string,{id:string;name:string;count:number;seconds:number}>}>()
  const lookup=new Map(categories.map(c=>[c.id,c]))
  for(const r of records){
    const id=r.categoryId
    const cat=lookup.get(id)
    const group=byCategory.get(id)||{id,name:cat?.name||'未分类',color:reviewColor(cat),count:0,seconds:0,items:new Map()}
    const itemId=r.taskId||taskName(r)
    const item=group.items.get(itemId)||{id:itemId,name:taskName(r),count:0,seconds:0}
    const seconds=recordDuration(r)
    item.count++;item.seconds+=seconds
    group.items.set(itemId,item);group.count++;group.seconds+=seconds
    byCategory.set(id,group)
  }
  return [...byCategory.values()].map(g=>({...g,items:[...g.items.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh-CN'))})).sort((a,b)=>b.count-a.count)
}

export function monthlyInvestment(records:CheckInRecord[],entries:TimelineEntry[],year:number,month:number,categoryId:string,first=1){
  const days=monthDays(year,month), weeks:{start:Date;end:Date;seconds:number}[]=[]
  const byDay=new Map<string,number>()
  const add=(key:string,seconds:number)=>byDay.set(key,(byDay.get(key)||0)+seconds)
  const prefix=fmtDate(days[0]).slice(0,7)
  const includes=(date:string,cat?:string)=>date.startsWith(prefix)&&(!categoryId||cat===categoryId)
  records.forEach(r=>{if(includes(r.date,r.categoryId))add(r.date,recordDuration(r))})
  entries.forEach(e=>{if(includes(e.date,e.categoryId))add(e.date,timelineDurationSeconds(e.startTime,e.endTime))})
  for(const day of days){
    const prev=weeks[weeks.length-1]
    const seconds=byDay.get(fmtDate(day))||0
    if(!prev||day.getDay()===first)weeks.push({start:day,end:day,seconds})
    else{prev.end=day;prev.seconds+=seconds}
  }
  return weeks
}
export function buildReviewTimeline(date:string,records:CheckInRecord[],entries:TimelineEntry[],categories:Category[]){
  return buildDayTimeline(date,records,entries,categories.map(c=>({...c,color:reviewColor(c)})))
}

export function clockMinute(value:string){
  const [h,m]=value.split(':').map(Number)
  return Number.isFinite(h)&&Number.isFinite(m)?Math.max(0,Math.min(1439,h*60+m)):0
}
export function minuteClock(value:number){
  const n=Math.round(value)%1440
  return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')
}
export function timelineSpan(item:DayTimelineItem){
  const start=clockMinute(item.time)
  const rawEnd=item.endTime?clockMinute(item.endTime):start+Math.floor(item.dur/60)
  const end=rawEnd<start?rawEnd+1440:rawEnd
  return {start,end,point:end===start}
}
export function timelineBounds(items:DayTimelineItem[]){
  const spans=items.map(timelineSpan)
  return {start:Math.min(480,...spans.map(x=>Math.floor(x.start/60)*60)),end:Math.max(1320,...spans.map(x=>Math.ceil(x.end/60)*60))}
}
export function visibleRailTicks(labels:{left:number;right:number}[], gap=4){
  const last=labels.length-1
  if(last<1)return labels.map(()=>true)
  let previousRight=labels[0].right
  return labels.map(({left,right},i)=>{
    if(i===0||i===last)return true
    if(left<previousRight+gap||right+gap>labels[last].left)return false
    previousRight=right
    return true
  })
}
export function overlapOffsets(items:DayTimelineItem[]){
  const laneEnds:number[]=[]
  return items.map(item=>{
    const span=timelineSpan(item)
    if(span.point)return 0
    const free=laneEnds.findIndex(end=>end<=span.start)
    const lane=free===-1?laneEnds.length:free
    laneEnds[lane]=span.end
    return lane
  })
}
