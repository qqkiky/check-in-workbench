import { Capacitor, registerPlugin } from '@capacitor/core'
import { appStorage, flushPrivateStorage } from './appStorage'
import { useStore } from '@/store'
import { buildCalendarEvents } from './calendarPlan'
import { observeScheduleChanges } from './coach'
const Native=registerPlugin<{test():Promise<void>;status():Promise<{granted:boolean;exact:boolean}>;enable():Promise<{granted:boolean;exact:boolean}>;exactSettings():Promise<void>;sync(options:{events:unknown[]}):Promise<void>}>('CoachReminders')
const KEY='wb.coach.reminders.v1'
export interface CoachReminderConfig {enabled:boolean;interval:number;quietStart:string;quietEnd:string}
export function readCoachReminders():CoachReminderConfig {try{return {...{enabled:false,interval:30,quietStart:'00:00',quietEnd:'07:00'},...JSON.parse(appStorage.getItem(KEY)||'{}')}}catch{return {enabled:false,interval:30,quietStart:'00:00',quietEnd:'07:00'}}}
export const reminderStatus=()=>Capacitor.getPlatform()==='android'?Native.status():Promise.resolve({granted:false,exact:false})
export const testCoachNotification=()=>Native.test()
export const requestCoachPermission=()=>Native.enable()
export const openExactReminderSettings=()=>Native.exactSettings()
export async function saveCoachReminders(config:CoachReminderConfig){
 if(![15,30,60].includes(config.interval)||![config.quietStart,config.quietEnd].every(clock=>/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)))throw new Error('请填写有效提醒设置')
 if(config.enabled&&!(await reminderStatus()).granted)throw new Error('请先允许期待发送通知')
 appStorage.setItem(KEY,JSON.stringify(config));await flushPrivateStorage();await syncCoachReminders()
}
export function reminderEvents(now=new Date()){
 const state=useStore.getState()
 if(!readCoachReminders().enabled)return []
 return state.tasks.flatMap(task=>!task.scheduledTime?[]:buildCalendarEvents(task,state.records,now).filter(event=>!event.completed&&!event.allDay&&event.startMillis>=now.getTime()-4*3600000).map(event=>({key:event.taskId,taskId:task.id,date:event.taskId.split('@').pop(),title:task.title,time:task.scheduledTime,at:event.startMillis,rule:[task.recurrence,task.scheduledDate||'',JSON.stringify(task.weekdays||null),task.monthDay||0].join('|')}))).sort((a,b)=>a.at-b.at).slice(0,3000)
}
let queue=Promise.resolve()
export function syncCoachReminders(){
 if(Capacitor.getPlatform()!=='android')return Promise.resolve()
 queue=queue.catch(()=>{}).then(async()=>{await flushPrivateStorage();await Native.sync({events:reminderEvents()})})
 return queue
}
let started=false
export function initCoachReminders(){
 if(started||Capacitor.getPlatform()!=='android')return
 started=true
 let previous=useStore.getState().tasks.map(task=>({...task})),signature=''
 const sync=()=>{
  const state=useStore.getState();if(!state.initialized)return
  observeScheduleChanges(previous,state.tasks);previous=state.tasks.map(task=>({...task}))
  const next=JSON.stringify([state.tasks,state.records,readCoachReminders()])
  if(next===signature)return
  signature=next
  void syncCoachReminders().catch(()=>{signature='';window.dispatchEvent(new Event('coach-reminder-error'))})
 }
 useStore.subscribe(sync)
 window.addEventListener('coach-settings-saved',()=>{signature='';sync()})
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){signature='';sync()}})
 setInterval(()=>{if(document.visibilityState==='visible'){signature='';sync()}},3600000)
 sync()
}
