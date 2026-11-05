import { Capacitor, registerPlugin } from '@capacitor/core'
import { appStorage, flushPrivateStorage } from './appStorage'
const KEY='wb.coach.daily.v1'
export interface DailyConfig {enabled:boolean;morning:string;evening:string}
export interface DailyReport {date:string;slot:string;status:string;at:number;text?:string;question?:string;sourceMemoryId?:string}
export interface DailyStatus {reports:DailyReport[];used:number}
const Native=registerPlugin<{configure():Promise<void>;status():Promise<DailyStatus>}>('CoachDaily')
let latest:DailyStatus={reports:[],used:0}
export const readDailyConfig=():DailyConfig=>{try{return {enabled:true,morning:'08:00',evening:'21:00',...JSON.parse(appStorage.getItem(KEY)||'{}')}}catch{return {enabled:false,morning:'08:00',evening:'21:00'}}}
export async function saveDailyConfig(value:DailyConfig){
 if(![value.morning,value.evening].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||value.morning>=value.evening)throw Error('早间时间应早于晚间时间')
 appStorage.setItem(KEY,JSON.stringify(value));await flushPrivateStorage()
 if(Capacitor.getPlatform()==='android')await Native.configure()
 window.dispatchEvent(new Event('coach-daily-updated'))
}
export const dailyStatus=()=>latest
export async function refreshDaily(){
 if(Capacitor.getPlatform()==='android')try{const result=await Native.status();if(!result||!Array.isArray(result.reports))return latest;latest=result;window.dispatchEvent(new Event('coach-daily-updated'))}catch{/* Keep the last readable local report. */}
 return latest
}
export function currentDailyReport(){
 const d=new Date(),day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
 if(!readDailyConfig().enabled)return undefined
 let memories: {id:string}[]=[]
 try{memories=JSON.parse(appStorage.getItem('wb.coach.memories.v1')||'[]')}catch{}
 return latest.reports.filter(r=>r.status==='ok'&&r.date===day&&memories.length&&(!r.sourceMemoryId||memories.some(m=>m.id===r.sourceMemoryId))).slice(-1)[0]
}
let started=false
export function initDailyCoach(){
 if(started||Capacitor.getPlatform()!=='android')return
 started=true
 const configure=async()=>{await flushPrivateStorage();if(!appStorage.getItem(KEY)){appStorage.setItem(KEY,JSON.stringify(readDailyConfig()));await flushPrivateStorage()}await Native.configure();await refreshDaily()}
 void configure().catch(()=>{})
 window.addEventListener('coach-data-saved',()=>void configure().catch(()=>{}))
 const resume=()=>{if(document.visibilityState==='visible')void refreshDaily()}
 document.addEventListener('visibilitychange',resume)
 setInterval(resume,30000)
}
