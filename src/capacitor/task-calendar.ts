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
import type { Task } from '@/types'

interface TaskCalendarPlugin {
  syncTask(opts: {
    taskId: string
    title: string
    startMillis: number
    endMillis: number
    reminderLeadMin: number
    description?: string
  }): Promise<{ ok: boolean; eventId: number }>
  syncAll(opts: { tasks: any[] }): Promise<{ ok: boolean; synced: number }>
  removeTask(opts: { taskId: string }): Promise<{ ok: boolean; removed: number }>
  checkPermissions(): Promise<{ calendar: string }>
  requestPermissions(): Promise<{ calendar: string }>
}

const TaskCalendar = registerPlugin<TaskCalendarPlugin>('TaskCalendar')
const isNative = Capacitor.getPlatform() !== 'web'

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
export async function syncTaskToCalendar(task: Task): Promise<void> {
  if (!isNative) return
  if (!task.reminderEnabled || !task.scheduledTime || !task.scheduledDate) return
  const start = parseMillis(task.scheduledDate, task.scheduledTime)
  if (start == null) return
  const dur = task.duration && task.duration > 0 ? task.duration * 60000 : 30 * 60000
  const ok = await ensureCalendarPermission()
  if (!ok) return
  try {
    await TaskCalendar.syncTask({
      taskId: task.id,
      title: task.title,
      startMillis: start,
      endMillis: start + dur,
      reminderLeadMin: task.reminderLead ?? 0,
      description: task.description || '',
    })
  } catch (e) {
    console.warn('[task-calendar] syncTask failed', e)
  }
}

/** 从系统日历删除指定待办对应的事件 */
export async function removeTaskFromCalendar(taskId: string): Promise<void> {
  if (!isNative) return
  try {
    await TaskCalendar.removeTask({ taskId })
  } catch (e) {
    console.warn('[task-calendar] removeTask failed', e)
  }
}

/** 批量把一组待办同步到系统日历（用于「全量/今日同步」入口） */
export async function syncTasksToCalendar(tasks: Task[]): Promise<void> {
  if (!isNative) return
  const ok = await ensureCalendarPermission()
  if (!ok) return
  const list = tasks
    .filter((t) => t.reminderEnabled && t.scheduledTime && t.scheduledDate)
    .map((t) => {
      const start = parseMillis(t.scheduledDate, t.scheduledTime)!
      const dur = t.duration && t.duration > 0 ? t.duration * 60000 : 30 * 60000
      return {
        taskId: t.id,
        title: t.title,
        startMillis: start,
        endMillis: start + dur,
        reminderLeadMin: t.reminderLead ?? 0,
        description: t.description || '',
      }
    })
  if (!list.length) return
  try {
    await TaskCalendar.syncAll({ tasks: list })
  } catch (e) {
    console.warn('[task-calendar] syncAll failed', e)
  }
}
