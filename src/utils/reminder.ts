// 待办提醒引擎
// 说明（PWA 离线限制）：纯前端 PWA 没有后台推送能力，提醒只在「应用处于打开/前台」时触发。
// - 应用内：弹出带「去完成」动作的提示（始终可用）
// - 系统通知：在用户授权且浏览器支持时（Android Chrome / 桌面 Chrome），
//   额外弹出系统通知；iOS Safari 不支持网页通知，仅应用内提示。
// - 触感：支持的移动端会轻振动一下

import { useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { showActionToast } from '@/components/common/Toast'
import { APP_NAME } from '@/types'
import type { Task, CheckInRecord } from '@/types'
import { fmtDate } from '@/utils/date'
import { taskOccursOnDate } from '@/utils/recurrence'

// 当天已触发提醒去重（任务 id + 日期），避免重算 / 刷新时重复触发
const firedKeys = new Set<string>()

// 应用刚打开、错过时间在 5 分钟内的，视为「刚过」并补发一次
const CATCHUP_MS = 5 * 60 * 1000

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** 计算任务下一次应提醒的时间（含提前量），向前扫描 7 天；无合适时间返回 null。
 *  catchupMs：允许「刚过去多久内」补发（首屏打开时放宽到 2 小时，平时 5 分钟）。 */
function nextReminderTime(task: Task, now: Date, catchupMs: number = CATCHUP_MS): Date | null {
  if (!task.scheduledTime) return null
  const [hh, mm] = task.scheduledTime.split(':').map(Number)
  const lead = task.reminderLead ?? 0
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const d = new Date(now)
    d.setDate(d.getDate() + dayOffset)
    const dow = d.getDay()
    const valid = taskOccursOnDate(task, d)
    if (!valid) continue
    const fire = new Date(d)
    fire.setHours(hh, mm - lead, 0, 0)
    // 允许「刚刚过去 catchupMs 内」补发
    if (fire.getTime() >= now.getTime() - catchupMs) return fire
  }
  return null
}

/** 触发一条提醒；已完成的任务不提醒。返回是否真正弹出。 */
function fireReminder(task: Task, records: CheckInRecord[]): boolean {
  const todayStr = fmtDate(new Date())
  const done = records.some((r) => r.taskId === task.id && r.date === todayStr)
  if (done) return false

  // 应用内提示（始终可用）
  showActionToast({
    message: `⏰ ${task.title}`,
    actionText: '去完成',
    duration: 10000,
    onAction: () => {
      window.location.hash = `task/${task.id}`
    },
  })

  // 系统通知（授权且支持时）
  const perm = getNotificationPermission()
  if (perm === 'granted') {
    try {
      const n = new Notification(`${APP_NAME} · 待办提醒`, {
        body: task.title,
        tag: `reminder-${task.id}-${todayStr}`,
        lang: 'zh-CN',
      })
      n.onclick = () => {
        try {
          window.focus()
        } catch {
          /* ignore */
        }
        window.location.hash = `task/${task.id}`
        n.close()
      }
    } catch {
      /* 某些环境构造通知会抛错，忽略，应用内提示已兜底 */
    }
  }

  // 轻振动（移动端）
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate?.([120, 60, 120])
    } catch {
      /* ignore */
    }
  }
  return true
}

/**
 * 应用级提醒调度器：在 App 挂载一次即可。
 * 监听 tasks / records / 总开关变化，重算并安排定时器。
 */
export function useReminderScheduler() {
  const tasks = useStore((s) => s.tasks)
  const records = useStore((s) => s.records)
  const enabled = useStore((s) => s.settings.notificationEnabled)
  const firstRun = useRef(true)

  useEffect(() => {
    if (!enabled) return
    const now = new Date()
    // 首屏打开时放宽补发窗口到 2 小时，避免「打开 App 时刚错过提醒」看不到
    const catchup = firstRun.current ? 2 * 60 * 60 * 1000 : CATCHUP_MS
    firstRun.current = false
    const timers: ReturnType<typeof setTimeout>[] = []

    for (const task of tasks) {
      if (task.archivedAt) continue
      if (!task.reminderEnabled) continue
      if (!task.scheduledTime) continue

      const when = nextReminderTime(task, now, catchup)
      if (!when) continue
      const key = `${task.id}-${fmtDate(when)}`
      if (firedKeys.has(key)) continue

      const delay = Math.max(0, when.getTime() - now.getTime())
      const t = setTimeout(() => {
        if (fireReminder(task, records)) firedKeys.add(key)
      }, delay)
      timers.push(t)
    }

    return () => {
      timers.forEach((id) => clearTimeout(id))
    }
  }, [tasks, records, enabled])
}
