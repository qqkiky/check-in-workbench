import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle=await build({stdin:{contents:"export * from './src/utils/review.ts';export * from './src/utils/timeline.ts'",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false})
const {buildDayTimeline,timelineSpan,timelineBounds,visibleRailTicks,overlapOffsets,monthlyInvestment,reviewGroups,calendarCounts,monthDays,mondayPadding}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const day='2026-11-05'
const at=(h,m,s=0)=>new Date(2026,10,5,h,m,s).getTime()
const record=(id,date=day,categoryId='work',durationSeconds=60)=>({id,taskId:id,taskTitle:id,date,categoryId,completedAt:at(14,0),durationSeconds})
const cats=[{id:'work',name:'工作',color:'#FF3B30'},{id:'life',name:'生活',color:'#34C759'}]
test('one minute is a point; a short event crossing the minute still has its own span',()=>{
 const a={...record('a'),startedAt:at(8,5,10),completedAt:at(8,5,20),durationSeconds:10}
 const b={...record('b'),startedAt:at(8,5,58),completedAt:at(8,6,1),durationSeconds:3}
 const [pa,pb]=buildDayTimeline(day,[a,b],[],cats).map(timelineSpan)
 assert.deepEqual(pa,{start:485,end:485,point:true})
 assert.deepEqual(pb,{start:485,end:486,point:false})
})
test('overlap lanes release at the end and cross-midnight notes keep their real duration',()=>{
 const items=buildDayTimeline(day,[],[
  {id:'long',date:day,content:'长记录',startTime:'14:00',endTime:'16:40'},
  {id:'short',date:day,content:'并行记录',startTime:'14:30',endTime:'15:20'},
  {id:'late',date:day,content:'晚记事',startTime:'23:45',endTime:'00:15'}
 ],cats)
 assert.deepEqual(overlapOffsets(items),[0,1,0])
 assert.deepEqual(timelineSpan(items[2]),{start:1425,end:1455,point:false})
 assert.equal(items[2].dur,1800)
 assert.ok(timelineBounds(items).end>=1455)
})
test('category filters include only selected month records, including the last partial week',()=>{
 const records=[record('last','2026-11-30','work',3600),record('first','2026-11-01','work',60),record('other','2026-11-05','life',3600),record('outside','2026-12-01','work',7200)]
 const entries=[{date:day,categoryId:'work',startTime:'12:00',endTime:'12:30'},{date:'2026-10-30',categoryId:'work',startTime:'12:00',endTime:'14:00'}]
 const weeks=monthlyInvestment(records,entries,2026,10,'work')
 assert.equal(weeks.length,6)
 assert.equal(weeks[0].seconds,60)
 assert.equal(weeks[1].seconds,1800)
 assert.equal(weeks[5].start.getDate(),30)
 assert.equal(weeks[5].seconds,3600)
})
test('review groups keep distinct tasks even when titles match and preserve zero-duration completions',()=>{
 const rows=[{...record('a'),taskTitle:'同名'}, {...record('b',day,'work',0),taskTitle:'同名'}, {...record('c'),taskId:'a',taskTitle:'同名'}]
 const [work]=reviewGroups(rows,cats)
 assert.equal(work.count,3)
 assert.equal(work.seconds,120)
 assert.equal(work.items.length,2)
 assert.equal(work.items.find(i=>i.id==='b').count,1)
 assert.equal(calendarCounts(rows).get(day),3)
 assert.equal(monthDays(2028,1).length,29)
 assert.equal(mondayPadding(monthDays(2026,10)[0]),6)
})

test('rail keeps the range endpoints and suppresses intermediate labels that collide',()=>{
 const labels=[[0,24],[31,55],[61,85],[91,115],[103,132]].map(([left,right])=>({left,right}))
 assert.deepEqual(visibleRailTicks(labels),[true,true,true,false,true])
 const wider=labels.map(({left,right},i)=>{
  const shift=i*20
  return {left:left+shift,right:right+shift}
 })
 assert.deepEqual(visibleRailTicks(wider),[true,true,true,true,true])
})
