/**
 * TaskCalendar —— 工作台待办 → 系统日历提醒（Capacitor 原生插件封装）
 * ----------------------------------------------------------------------------
 * - 仅在原生平台（Android）生效；Web / PWA 下所有方法为 no-op，绝不报错。
 * - 复用现有 Task 模型：reminderEnabled + scheduledTime + scheduledDate 决定
 *   是否写入系统日历事件并设置「到点提醒」（由系统日历进程负责弹提醒，
 *   主应用被杀也生效，MIUI 日历原生支持）。
 * - 时间统一由 Web 侧用 JS Date 算成毫秒再传给原生，原生不做日期解析，降低出错面。
 */
import { Capacitor } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'
import type { Task, CheckInRecord } from '@/types'
import { appStorage, flushPrivateStorage } from '@/services/appStorage'
import { buildCalendarEvents, type CalendarEvent } from '@/services/calendarPlan'
import { fmtDate } from '@/utils/date'
import { useStore } from '@/store'
import { planCalendarUpdates, type CalendarUpdate } from '@/services/calendarUpdates'
import { storage } from '@/services/storage'

interface TaskCalendarPlugin {
  syncTask(opts: {
    taskId: string
    title: string
    startMillis: number
    endMillis: number
    reminderLeadMin: number
    description?: string
  }): Promise<{ ok: boolean; eventId: number }>
  syncAll(opts: { tasks: CalendarEvent[]; plannedTaskIds: string[]; fromDate: string }): Promise<{ ok: boolean; synced: number; removed: number }>
  removeTask(opts: { taskId: string }): Promise<{ ok: boolean; removed: number }>
  reconcile(opts:{fullSnapshot:boolean;activeTaskIds:string[]}):Promise<{removed:number;deletedKeys:string[];changes?:CalendarUpdate[];newEvents?:CalendarUpdate[]}>
  getCalendars():Promise<{calendars:CalendarSource[]}>
  selectCalendars(opts:{ids:number[]}):Promise<void>
  rebind(opts:{bindings:{fromKey:string;toKey:string;eventId:number}[]}):Promise<void>
  addListener(event:'calendarChanged',callback:()=>void):Promise<{remove:()=>Promise<void>}>
  checkPermissions(): Promise<{ calendar: string }>
  requestPermissions(): Promise<{ calendar: string }>
}

const TaskCalendar = registerPlugin<TaskCalendarPlugin>('TaskCalendar')
const isNative = Capacitor.getPlatform() !== 'web'
const ENABLED_KEY = 'wb.calendar.enabled.v1'
export interface CalendarSyncReport { synced:number;removed:number;deletedTasks:number;cancelledOccurrences:number;importedTasks:number;updatedTasks:number }
export interface CalendarSource {id:number;name:string;account:string;selected:boolean}
let queue:Promise<unknown>=Promise.resolve()
function serial<T>(run:()=>Promise<T>):Promise<T> {
  const result=queue.catch(()=>{}).then(run)
  queue=result.catch(()=>{})
  return result
}
export function isCalendarSyncEnabled() { return appStorage.getItem(ENABLED_KEY) === '1' }
export async function enableCalendarSync() {
  if (!await ensureCalendarPermission()) return false
  appStorage.setItem(ENABLED_KEY, '1')
  return true
}

/** 当前是否运行在原生平台（Android/iOS）。Web 端为 false，调用日历能力时均为 no-op */
export const isCalendarAvailable = isNative

/** 把 YYYY-MM-DD + HH:mm 解析为本地毫秒；缺省回退 09:00 */
function parseMillis(dateStr?: string, timeStr?: string): number | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = timeStr || '09:00'
  const [h, mi] = t.split(':').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, h || 9, mi || 0, 0, 0).getTime()
}

/** 申请日历权限（首次写入前调用）。返回是否已授权 */
export async function ensureCalendarPermission(): Promise<boolean> {
  if (!isNative) return false
  try {
    const s = await TaskCalendar.checkPermissions()
    if (s.calendar === 'granted' || s.calendar === 'limited') return true
    const r = await TaskCalendar.requestPermissions()
    return r.calendar === 'granted' || r.calendar === 'limited'
  } catch {
    return false
  }
}

/** 同步单条待办到系统日历（不满足提醒条件则静默跳过） */
export async function syncTaskToCalendar(task: Task, records: CheckInRecord[] = []): Promise<void> {
  if (!isNative) return
  try {
    await performSync(new Set([task.id]),false)
  } catch (e) {
    window.dispatchEvent(new Event('calendar-sync-error'))
  }
}

/** 从系统日历删除指定待办对应的事件 */
export async function removeTaskFromCalendar(taskId: string): Promise<void> {
  if (!isNative || !isCalendarSyncEnabled()) return
  try {
    await serial(async()=>{await flushPrivateStorage();await TaskCalendar.removeTask({ taskId })})
  } catch (e) {
    console.warn('[task-calendar] removeTask failed', e)
  }
}

/** 批量把一组待办同步到系统日历（用于「全量/今日同步」入口） */
export async function syncTasksToCalendar(_tasks: Task[], _records: CheckInRecord[] = []): Promise<number> {
  return (await syncCalendarWithCleanup()).synced
}

export function syncCalendarWithCleanup():Promise<CalendarSyncReport> { return performSync(null,true) }
export async function getCalendarSources() {
  if(!await ensureCalendarPermission())throw new Error('请先授予日历权限')
  return (await TaskCalendar.getCalendars()).calendars
}
export async function setCalendarSources(ids:number[]) {
  if(!await enableCalendarSync())throw new Error('请先授予日历权限')
  await TaskCalendar.selectCalendars({ids})
  return syncCalendarWithCleanup()
}

export function watchCalendarChanges(callback:()=>void) {
  if(!isNative)return ()=>{}
  let disposed=false,handle:{remove:()=>Promise<void>}|undefined
  void TaskCalendar.addListener('calendarChanged',callback).then(value=>{if(disposed)void value.remove();else handle=value}).catch(()=>{})
  return ()=>{disposed=true;void handle?.remove()}
}

function performSync(requested:Set<string>|null,fullSnapshot:boolean):Promise<CalendarSyncReport> {
  return serial(async()=>{
    const report={synced:0,removed:0,deletedTasks:0,cancelledOccurrences:0,importedTasks:0,updatedTasks:0}
    if(!isNative||!isCalendarSyncEnabled())return report
    if(!useStore.getState().initialized)throw new Error('本机数据尚未加载，未处理日历删除')
    await flushPrivateStorage()
    if((await TaskCalendar.checkPermissions()).calendar!=='granted')throw new Error('请重新授予日历权限')
    const state=useStore.getState()
    const result=await TaskCalendar.reconcile({fullSnapshot,activeTaskIds:state.tasks.filter(task=>!task.archivedAt&&(task.scheduledTime||task.calendarAllDay)).map(task=>task.id)})
    if(!Array.isArray(result.deletedKeys)||result.deletedKeys.some(key=>typeof key!=='string'))throw new Error('日历删除核对结果无效，未改变本机任务')
    report.removed=result.removed
    Object.assign(report,useStore.getState().applyCalendarDeletions(result.deletedKeys))
    const current=useStore.getState()
    const updates=planCalendarUpdates(current.tasks,current.records,[...(result.changes||[]),...(result.newEvents||[])],requested||new Set())
    report.importedTasks=updates.imported;report.updatedTasks=updates.changed-updates.imported
    if(updates.changed){storage.setTasks(updates.tasks);storage.setRecords(updates.records);await flushPrivateStorage();current.reload()}
    if(updates.rebindings.length)await TaskCalendar.rebind({bindings:updates.rebindings})
    await flushPrivateStorage()
    const latest=useStore.getState(),tasks=requested?latest.tasks.filter(task=>requested.has(task.id)):latest.tasks
    for(const task of tasks.filter(task=>task.archivedAt||(!task.scheduledTime&&!task.calendarAllDay)))await TaskCalendar.removeTask({taskId:task.id})
    const planned=tasks.filter(task=>!task.archivedAt&&(task.scheduledTime||task.calendarAllDay))
    if(planned.length) {
      const now=new Date()
      const events=planned.flatMap(task=>buildCalendarEvents(task,latest.records,now))
      const result=await TaskCalendar.syncAll({tasks:events,plannedTaskIds:planned.map(task=>task.id),fromDate:fmtDate(now)})
      report.synced=result.synced
      report.removed+=result.removed
    }
    return report
  })
}
