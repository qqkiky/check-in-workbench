import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DayTimelineItem } from '@/utils/timeline'
import { minuteClock, overlapOffsets, timelineBounds, timelineSpan, visibleRailTicks } from '@/utils/review'
import { secondsToCompact } from '@/utils/date'
import { ReviewEmpty } from './ReviewParts'

const titleOf=(it:DayTimelineItem)=>it.title||it.content||'未命名事项'
const itemKey=(it:DayTimelineItem)=>it.type+'-'+it.id
const tint=(color:string,alpha:number)=>`color-mix(in srgb, ${color} ${alpha}%, transparent)`
type Bounds=ReturnType<typeof timelineBounds>

function RailTicks({ticks,position}:{ticks:number[];position:(minute:number)=>number}){
  const axis=useRef<HTMLDivElement>(null)
  const [visible,setVisible]=useState<boolean[]>([])
  const tickKey=ticks.join(',')
  useLayoutEffect(()=>{
    const element=axis.current!
    const labels=Array.from(element.querySelectorAll('span'))
    const update=()=>setVisible(visibleRailTicks(labels.map(label=>label.getBoundingClientRect())))
    const observer=new ResizeObserver(update)
    observer.observe(element)
    labels.forEach(label=>observer.observe(label))
    update()
    return ()=>observer.disconnect()
  },[tickKey])
  return <div className="rv-rail-ticks" ref={axis}>{ticks.map((t,i)=><span key={t} style={{
    left:position(t)+'%',
    transform:i===0?'none':i===ticks.length-1?'translateX(-100%)':'translateX(-50%)',
    visibility:visible[i]===false?'hidden':undefined,
  }}>{minuteClock(t)}{t>=1440?'⁺':''}</span>)}</div>
}

export function TimeRail({items,bounds=timelineBounds(items),onJump,showTicks=true}:{items:DayTimelineItem[];bounds?:Bounds;onJump?:(minute:number)=>void;showTicks?:boolean}){
  const lanes=overlapOffsets(items)
  const pos=(n:number)=>100*(n-bounds.start)/(bounds.end-bounds.start)
  const middle=Array.from({length:6},(_,i)=>(i+1)*240).filter(t=>t>bounds.start+90&&t<bounds.end-90)
  const ticks=[bounds.start,...middle,bounds.end]
  return <div className="rv-rail-wrap">
    <div className="rv-rail" aria-label="时段概览" onClick={onJump?e=>{const r=e.currentTarget.getBoundingClientRect();onJump(bounds.start+(e.clientX-r.left)/r.width*(bounds.end-bounds.start))}:undefined}>
      {middle.map(t=><i key={t} className="rv-rail-tick" style={{left:pos(t)+'%'}}/>)}
      {items.map((it,i)=>{
        const span=timelineSpan(it)
        return <span key={itemKey(it)} title={titleOf(it)} className={span.point?'rv-rail-point':'rv-rail-block'} style={{left:span.point?`clamp(3px, ${pos(span.start)}%, calc(100% - 3px))`:pos(span.start)+'%',...(span.point?{backgroundColor:it.color}:{width:Math.max(.25,pos(span.end)-pos(span.start))+'%',top:2+Math.min(2,lanes[i])*2,backgroundColor:tint(it.color,57)})}}/>
      })}
    </div>
    {showTicks&&<RailTicks ticks={ticks} position={pos}/>}
  </div>
}

export function ReviewItemList({items,onEdit,onDelete,selected}:{items:DayTimelineItem[];onEdit?:(id:string)=>void;onDelete?:(id:string)=>void;selected?:string|null}){
  if(!items.length)return <ReviewEmpty>这一天还没有记录</ReviewEmpty>
  return <div className="rv-item-list">{items.map(it=>{
    const span=timelineSpan(it)
    return <div key={itemKey(it)} className={'rv-item'+(selected===itemKey(it)?' rv-item-selected':'')}>
      <span className={span.point?'rv-item-dot':'rv-item-block'} style={{backgroundColor:it.color}}/>
      <span className="rv-item-time">{it.time}{!span.point&&<small>–{minuteClock(span.end)}{span.end>=1440?'⁺':''}</small>}</span>
      <div className="rv-item-name"><strong>{titleOf(it)}</strong>{it.isMakeup&&<small>补卡</small>}
        {it.type==='note'&&onEdit&&<div className="rv-item-actions"><button onClick={()=>onEdit(it.id)}>编辑</button><button onClick={()=>onDelete?.(it.id)}>删除</button></div>}
      </div>
      {!span.point&&it.dur>0&&<span className="rv-item-duration">{secondsToCompact(it.dur)}</span>}
    </div>
  })}</div>
}

export function DailyTimeline({items,onEdit,onDelete}:{items:DayTimelineItem[];onEdit:(id:string)=>void;onDelete:(id:string)=>void}){
  const bounds=useMemo(()=>timelineBounds(items),[items])
  const lanes=overlapOffsets(items)
  const [selected,setSelected]=useState<string|null>(null)
  const viewport=useRef<HTMLDivElement>(null)
  const scale=1.45
  const top=(m:number)=>(m-bounds.start)*scale
  const first=items.length?timelineSpan(items[0]).start:bounds.start
  useEffect(()=>{if(viewport.current)viewport.current.scrollTop=Math.max(0,(first-bounds.start-24)*scale)},[first,bounds.start])
  const labels:number[]=[]
  items.forEach((it,i)=>{labels[i]=Math.max(top(timelineSpan(it).start),i?labels[i-1]+24:0)})
  const height=Math.max(top(bounds.end)+20,(labels[labels.length-1]||0)+29)
  const ticks=Array.from({length:Math.floor((bounds.end-bounds.start)/60)+1},(_,i)=>bounds.start+i*60)
  return <>
    <section className="rv-card"><h3>全天时段</h3><TimeRail items={items} bounds={bounds} onJump={m=>viewport.current?.scrollTo({top:Math.max(0,top(m)-18),behavior:'smooth'})}/></section>
    <section className="rv-card"><h3>时间线</h3>
      {items.length?<div className="rv-timeline-viewport" ref={viewport} tabIndex={0} aria-label="滚动查看单日时间轴">
        <div className="rv-timeline-axis" style={{height}}>
          {ticks.map(t=><div key={t} className="rv-hour" style={{top:top(t)}}><span>{minuteClock(t)}{t>=1440?'⁺':''}</span></div>)}
          {items.map((it,i)=>{
            const span=timelineSpan(it), lane=Math.min(3,lanes[i]), y=top(span.start)
            return <div key={itemKey(it)} className={span.point?'rv-timeline-point':'rv-timeline-block'} aria-hidden="true" style={{top:y,...(span.point?{background:it.color}:{height:Math.max(1,top(span.end)-y),left:lane*18,right:32-lane*10,background:tint(it.color,30),borderColor:tint(it.color,75)})}}/>
          })}
          {items.map((it,i)=>{
            const span=timelineSpan(it),y=top(span.start),labelY=labels[i],left=span.point?14:8+18*Math.min(3,lanes[i])
            return <div key={itemKey(it)}>{labelY-y>8&&<i aria-hidden="true" className="rv-timeline-leader" style={{left,top:y,height:labelY-y}}/>}
              <button type="button" className="rv-timeline-label" style={{top:labelY,left,maxWidth:`calc(100% - ${left+2}px)`}} title={titleOf(it)} onClick={()=>setSelected(itemKey(it))}><span>{titleOf(it)}</span><small>{it.time}{!span.point?'–'+minuteClock(span.end):''}</small></button>
            </div>
          })}
        </div>
      </div>:<ReviewEmpty>这一天还没有记录</ReviewEmpty>}
    </section>
    {items.length>0&&<section className="rv-card"><h3>当天记录</h3><ReviewItemList items={items} onEdit={onEdit} onDelete={onDelete} selected={selected}/></section>}
  </>
}
