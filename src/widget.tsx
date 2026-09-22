import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { CategoryIcon } from '@/utils/iconLibrary'
import { dt, fmtDate, getLunarDay } from '@/utils/date'
import { APP_NAME } from '@/types'
import './index.css'

// 桌面小组件：实时显示当天待办与进度（读取同一 localStorage，离线可用）
function Widget() {
  const { tasks, categories, records, getTodayTasks, addRecord, reload } = useStore()
  const [now, setNow] = useState(new Date())
  const [installed, setInstalled] = useState<boolean>(
    typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
  )
  const todayStr = fmtDate(now)

  // 每 30 秒刷新一次，并确保从存储重新读取（主 App 写入后即时反映）
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date())
      reload()
    }, 30000)
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [reload])

  const todayTasks = getTodayTasks()
  const done = todayTasks.filter((t) => t.completed).length
  const total = todayTasks.length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const quickTasks = tasks.filter((t) => t.isQuick && !t.archivedAt)
  const quicks = quickTasks.map((t) => ({
    id: t.id,
    title: t.title,
    done: !!records.find((r) => r.taskId === t.id && r.date === todayStr),
  }))

  const toggleQuick = (id: string, done: boolean) => {
    const task = tasks.find((t) => t.id === id)
    if (!task || done) return
    addRecord({
      taskId: task.id,
      taskTitle: task.title,
      categoryId: task.categoryId,
      date: todayStr,
      completedAt: Date.now(),
      durationSeconds: 0,
    })
    reload()
  }

  // 未安装到主屏幕：显示引导卡（在浏览器中直接打开时）
  if (!installed) {
    return <InstallHint onDismiss={() => setInstalled(true)} />
  }

  return (
    <div className="w-full h-full bg-[#F2F2F7] text-gray-900 overflow-hidden">
      {/* 头部 */}
      <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <Icons.Clock size={15} />
          </span>
          <span className="text-base font-semibold">{APP_NAME} · 今日</span>
        </div>
        <span className="text-[11px] text-gray-400">{getLunarDay(now)}</span>
      </div>

      {/* 进度 */}
      <div className="px-3.5 mb-2">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
          <span>{dt.format(now, 'MM/dd EEEE')}</span>
          <span className="font-semibold text-gray-700">{done}/{total} · {pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* 任务列表（最多 8 条） */}
      <div className="px-3.5 space-y-1.5 overflow-y-auto" style={{ maxHeight: 'calc(100% - 96px)' }}>
        {todayTasks.slice(0, 8).map((t) => {
          const cat = categories.find((c) => c.id === t.categoryId)
          return (
            <div key={t.id} className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1.5 shadow-sm">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${t.completed ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              <span className="text-gray-400 shrink-0">
                <CategoryIcon category={cat || { emoji: '📌' }} size={13} />
              </span>
              {t.scheduledTime && (
                <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{t.scheduledTime}</span>
              )}
              <span className={`flex-1 text-[13px] truncate ${t.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {t.title}
              </span>
            </div>
          )
        })}

        {quicks.map((q) => (
          <button
            key={q.id}
            onClick={() => toggleQuick(q.id, q.done)}
            className="w-full flex items-center gap-2 bg-white rounded-xl px-2.5 py-1.5 shadow-sm text-left"
          >
            <span
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                q.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent'
              }`}
            >
              <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className={`flex-1 text-[13px] truncate ${q.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {q.title}
            </span>
          </button>
        ))}

        {total === 0 && quicks.length === 0 && (
          <div className="text-center text-gray-400 text-[12px] py-6">今天还没有待办</div>
        )}
      </div>
    </div>
  )
}

// 在浏览器中打开 widget 页面时显示的引导（加到主屏幕后即可进入小组件）
function InstallHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="w-full min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-6 space-y-3">
        <div className="text-2xl">📲</div>
        <h2 className="text-lg font-bold text-gray-900">把小组件添加到主屏幕</h2>
        <p className="text-sm text-gray-600">
          在桌面/主屏一键查看今天的待办与打卡进度，离线也能用。
        </p>
        <InstallSteps />
        <div className="flex gap-2 pt-1">
          <a
            href="./"
            className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium flex items-center justify-center"
          >
            打开主应用
          </a>
          <button
            onClick={onDismiss}
            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-medium active:scale-95"
          >
            暂时不用
          </button>
        </div>
      </div>
    </div>
  )
}

function InstallSteps() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  const isAndroid = /Android/.test(ua) && /Chrome/.test(ua)
  if (isIOS) {
    return (
      <ol className="text-sm text-gray-700 space-y-1 list-decimal pl-5">
        <li>点击 Safari 底部的 <b>分享按钮</b> ⬆️</li>
        <li>选择 <b>「添加到主屏幕」</b></li>
        <li>确认后点击右上角 <b>「添加」</b></li>
        <li>从桌面图标打开即可看到今日待办小组件</li>
      </ol>
    )
  }
  if (isAndroid) {
    return (
      <ol className="text-sm text-gray-700 space-y-1 list-decimal pl-5">
        <li>点击右上角菜单 ⋮</li>
        <li>选择 <b>「添加到主屏幕」</b> 或「安装应用」</li>
        <li>桌面会出现「期待小组件」图标</li>
      </ol>
    )
  }
  return (
    <ol className="text-sm text-gray-700 space-y-1 list-decimal pl-5">
      <li>点击地址栏右侧的 <b>「安装」</b> 图标</li>
      <li>在弹窗中点「安装」</li>
      <li>从桌面 / 开始菜单直接打开</li>
    </ol>
  )
}

ReactDOM.createRoot(document.getElementById('widget-root')!).render(
  <React.StrictMode>
    <Widget />
  </React.StrictMode>
)

// 注册 Service Worker（widget 页面是独立入口，需自行注册，否则 Chrome 不允许安装）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* 注册失败不影响正常使用 */
    })
  })
}
