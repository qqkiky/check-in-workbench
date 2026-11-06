import { CategoryIcon, ICON_NAMES, type IconName } from '@/utils/iconLibrary'
import './categoryPicker.css'

const featured: {id:IconName;label:string}[]=[
  {id:'briefcase',label:'工作'},{id:'flask',label:'实验'},{id:'book',label:'阅读'},{id:'dumbbell',label:'运动'},
  {id:'home',label:'生活'},{id:'heart',label:'健康'},{id:'car',label:'出行'},{id:'graduation',label:'学习'},
  {id:'target',label:'专注'},{id:'moon',label:'休息'},{id:'wallet',label:'财务'},{id:'lightbulb',label:'灵感'},
]
const other=ICON_NAMES.filter(id=>!featured.some(item=>item.id===id))

const iconFills:Partial<Record<IconName,string>>={briefcase:'#EAB19F',flask:'#A7CADA',book:'#B6C6E5',dumbbell:'#C7B9E4',home:'#B3CDB2',heart:'#E9B1A9',car:'#AFC7DB',graduation:'#E4CB9E',target:'#E5A391',moon:'#CEC3E3',wallet:'#C5D2AC',lightbulb:'#EAD494'}

export function IconPicker({value,onChange}:{value?:string;onChange:(name:IconName)=>void}){
  const option=(id:IconName,label?:string)=><button className="category-icon-choice" type="button" key={id} aria-label={label||id} aria-pressed={value===id} onClick={()=>onChange(id)}>
    <CategoryIcon category={{icon:id}} color={value===id?'#36596a':'#454e45'} size={22} filled fillColor={iconFills[id]}/>
    {label&&<span>{label}</span>}
  </button>
  return <>
    <div className="category-icon-featured">{featured.map(({id,label})=>option(id,label))}</div>
    <details className="category-icon-more" open={value&&other.includes(value as IconName)?true:undefined}>
      <summary>更多图标</summary><div>{other.map(id=>option(id))}</div>
    </details>
  </>
}

export const CATEGORY_PALETTE=[
  {color:'#D98179',name:'暖珊瑚'},{color:'#70A98B',name:'鼠尾草'},
  {color:'#80A3BE',name:'雾蓝'},{color:'#A498DA',name:'淡紫'},
  {color:'#BA996E',name:'麦芽'},{color:'#9DA89D',name:'岩灰'},
]
export const CATEGORY_COLORS=CATEGORY_PALETTE.map(p=>p.color)
