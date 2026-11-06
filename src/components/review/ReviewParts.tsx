import type { ReactNode } from 'react'
import type { Category } from '@/types'
import { Icons } from '@/components/common/Icons'

export function ReviewNav({title,note,onPrev,onNext,extra}:{title:string;note?:ReactNode;onPrev:()=>void;onNext:()=>void;extra?:ReactNode}){
  return <div className="rv-period">
    <div className="rv-period-main"><h2>{title}</h2><div className="rv-nav">
      <button aria-label="上一段" onClick={onPrev}><Icons.ChevronLeft size={16}/></button>
      <button aria-label="下一段" onClick={onNext}><Icons.ChevronRight size={16}/></button>
      {extra}
    </div></div>
    {note&&<p className="rv-muted">{note}</p>}
  </div>
}
export function ReviewSwitch<T extends string|number>({value,options,onChange}:{value:T;options:{key:T;label:string}[];onChange:(key:T)=>void}){
  return <div className="rv-switch">{options.map(option=><button key={option.key} type="button" aria-pressed={value===option.key} onClick={()=>onChange(option.key)}>{option.label}</button>)}</div>
}
export function ReviewCategoryFilter({categories,value,onChange,label='分类筛选'}:{categories:Category[];value:string;onChange:(id:string)=>void;label?:string}){
  return <select className="rv-select" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>
    <option value="">全部分类</option>
    {categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
  </select>
}
export function ReviewBar({value,max,color}:{value:number;max:number;color:string}){
  return <div className="rv-bar" aria-hidden="true"><span style={{width:`${max?Math.min(100,100*value/max):0}%`,backgroundColor:color}}/></div>
}
export function ReviewEmpty({children='暂无记录'}:{children?:ReactNode}){
  return <p className="rv-empty">{children}</p>
}
