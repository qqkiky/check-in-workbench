import { appStorage, flushPrivateStorage } from './appStorage'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { storage } from './storage'
import { useStore } from '@/store'
import type { Task, CheckInRecord } from '@/types'
import { syncTasksToCalendar } from '@/capacitor/task-calendar'

const CONFIG_KEY = 'wb.assistant.connection.v1'
const META_KEY = 'wb.assistant.versions.v1'
const NativeAssistant = registerPlugin<{ configure(options: { enabled: boolean }): Promise<void> }>('AssistantBackground')
export interface AssistantConfig { url: string; token: string; enabled: boolean }
export interface SharedSchedule {
  id: string; title: string; date: string; time: string; duration: number
  status: 'pending' | 'completed' | 'cancelled'; completedAt: number | null
  version: number; updatedAt: number
}
interface TaskMeta { version: number; fingerprint: string }

export function readAssistantConfig(): AssistantConfig | null {
  try { return JSON.parse(appStorage.getItem(CONFIG_KEY) || 'null') }
  catch { return null }
}
export function endpoint(raw: string) {
  const url = new URL(raw.trim())
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.port || url.pathname !== '/') throw new Error('请输入 HTTPS 服务根地址')
  return url.origin
}
export async function saveAssistantConfig(config: AssistantConfig) {
  if (config.token.length < 32) throw new Error('连接密钥长度不足')
  const clean = { url: endpoint(config.url), token: config.token.trim(), enabled: config.enabled }
  appStorage.setItem(CONFIG_KEY, JSON.stringify(clean))
  await flushPrivateStorage()
  if(Capacitor.getPlatform()==='android')await NativeAssistant.configure({enabled:config.enabled})
}

export function schedulePayload(task: Task, records: CheckInRecord[]) {
  if (task.recurrence !== 'none' || !task.scheduledDate || !task.scheduledTime) return null
  const record = records.find(record => record.taskId === task.id && record.date === task.scheduledDate)
  // Deliberately omit notes, descriptions, categories, record notes and financial data.
  return { id: task.id, title: task.title, date: task.scheduledDate, time: task.scheduledTime,
    duration: task.duration || 30, status: task.archivedAt ? 'cancelled' : record ? 'completed' : 'pending',
    completedAt: record?.completedAt || null }
}
function fingerprint(value: unknown) { return JSON.stringify(value) }

async function request(config: AssistantConfig, path: string, data?: unknown) {
  const response = await fetch(`${endpoint(config.url)}${path}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store',
  })
  if (!response.ok) throw new Error(`助手连接失败（${response.status}）`)
  return response.json()
}

let busy = false
export async function syncAssistant() {
  const config = readAssistantConfig()
  if (!config?.enabled) throw new Error('请先配置并启用微信日程助手')
  if (busy) throw new Error('正在同步，请稍候')
  busy = true
  try {
    const store = useStore.getState()
    let meta: Record<string, TaskMeta> = JSON.parse(appStorage.getItem(META_KEY) || '{}')
    const payloads = store.tasks.map(task => schedulePayload(task,store.records)).filter(Boolean)
    const changes = payloads.filter(task => meta[task!.id]?.fingerprint !== fingerprint(task))
      .map(task => ({ ...task, baseVersion: meta[task!.id]?.version || 0 }))
    for (const [id,previous] of Object.entries(meta)) {
      if(!payloads.some(task=>task!.id===id)) {
        const last=JSON.parse(previous.fingerprint)
        changes.push({...last,status:'cancelled',completedAt:null,baseVersion:previous.version})
      }
    }
    for (let offset=0; offset<changes.length; offset+=30) {
      const result = await request(config, '/v1/schedules', { tasks: changes.slice(offset,offset+30) })
      for (const accepted of result.accepted as SharedSchedule[]) {
        const local = payloads.find(task => task!.id === accepted.id)
        if(local) meta[accepted.id] = { version: accepted.version, fingerprint: fingerprint(local) }
      }
      // Conflicts are resolved by fetching the cloud version, never overwrite a newer chat update.
    }
    const remote = await request(config, '/v1/schedules')
    const latest = useStore.getState()
    const tasks = [...latest.tasks], records = [...latest.records]
    for (const item of remote.tasks as SharedSchedule[]) {
      if (!item?.id || !item.title || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !/^\d{2}:\d{2}$/.test(item.time)) continue
      const index = tasks.findIndex(task => task.id === item.id)
      const current = index >= 0 ? tasks[index] : undefined
      // Do not overwrite edits made on this device while the network was in flight.
      const base = payloads.find(task => task!.id === item.id)
      if(base && !current)continue
      if (current && base && fingerprint(schedulePayload(current,latest.records)) !== fingerprint(base)) continue
      const task: Task = { ...current, id:item.id, title:item.title, scheduledDate:item.date,
        scheduledTime:item.time, duration:item.duration, recurrence:'none', categoryId:current?.categoryId || 'work',
        reminderEnabled:current?.reminderEnabled ?? true, reminderLead:current?.reminderLead ?? 0,
        createdAt:current?.createdAt || item.updatedAt, updatedAt:item.updatedAt,
        archivedAt:item.status === 'cancelled' ? item.updatedAt : undefined }
      if(index>=0) tasks[index]=task;else tasks.unshift(task)
      const matching = records.filter(record=>record.taskId===item.id && record.date===item.date)
      if(item.status==='completed' && !matching.length) {
        records.unshift({id:`assistant-${item.id}-${item.date}`,taskId:item.id,taskTitle:item.title,
          categoryId:task.categoryId,date:item.date,completedAt:item.completedAt || item.updatedAt,durationSeconds:0})
      } else if(item.status==='pending') {
        for(let i=records.length-1;i>=0;i--) if(records[i].taskId===item.id && records[i].date===item.date) records.splice(i,1)
      }
      meta[item.id]={version:item.version,fingerprint:fingerprint(schedulePayload(task,records))}
    }
    storage.setTasks(tasks); storage.setRecords(records)
    appStorage.setItem(META_KEY,JSON.stringify(meta))
    await flushPrivateStorage()
    latest.reload()
    await syncTasksToCalendar(tasks,records)
    return { count:remote.tasks.length as number, deliveryError:!!remote.deliveryError, connected:!!remote.connected }
  } finally { busy=false }
}

let started = false
export function initAssistantSync() {
  if(started)return
  started=true
  if(Capacitor.getPlatform()==='android')void NativeAssistant.configure({enabled:!!readAssistantConfig()?.enabled}).catch(()=>{})
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule=()=>{
    if(!readAssistantConfig()?.enabled || busy)return
    clearTimeout(timer)
    timer=setTimeout(()=>void syncAssistant().catch(()=>{}),2000)
  }
  useStore.subscribe(schedule)
  window.addEventListener('online',schedule)
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule()})
  setInterval(()=>{if(document.visibilityState==='visible')schedule()},60000)
  schedule()
}
