import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useStore } from './store'
import { HomeScreen } from './screens/HomeScreen'
import { ListScreen } from './screens/ListScreen'
import { MoreScreen } from './screens/MoreScreen'
import { NotesScreen } from './screens/NotesScreen'
import { AccountingScreen } from './screens/AccountingScreen'
import { TimelineReviewScreen } from './screens/TimelineReviewScreen'
import { InfoScreen } from './screens/InfoScreen'
import { TaskDetailScreen } from './screens/TaskDetailScreen'
import { ToastHost } from './components/common/Toast'
import { useReminderScheduler } from './utils/reminder'
import { haptic } from './utils/capacitor'
import { applyThemeColor, DEFAULT_THEME } from './utils/theme'
import { initSyncManager } from './utils/syncManager'
import { pullOnly } from './services/cloudSync'
import { syncTasksToCalendar, watchCalendarChanges } from './capacitor/task-calendar'
import { Icons } from './components/common/Icons'
import { initAssistantSync } from './services/assistant'
import { focusNotification } from './services/coach'
import { initDailyCoach } from './services/coachDaily'
import { initCoachReminders } from './services/coachReminders'
import { AgentScreen } from './screens/AgentScreen'
import { listenForQuickChat } from './services/quickChat'
import { useCompactLayout } from './utils/useCompactLayout'
import './agenda.css'

type Tab = 'home' | 'account' | 'timeline' | 'info' | 'more' | 'notes' | 'agent'

// 底部主导航：Do(打卡) · 记账 · 回顾 · 资讯 · 更多（记账入口在「记账」Tab 内部，不再有中央 FAB）
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: '今日', icon: <Icons.Home size={20} /> },
  { key: 'account', label: '记账', icon: <Icons.Wallet size={20} /> },
  { key: 'timeline', label: '回顾', icon: <Icons.BarChart size={20} /> },
  { key: 'info', label: '资讯', icon: <Icons.Newspaper size={20} /> },
  { key: 'more', label: '更多', icon: <Icons.MoreHorizontal size={20} /> },
]

export default function App() {
  const init = useStore((s) => s.init)
  const initialized = useStore((s) => s.initialized)
  const settings = useStore((s) => s.settings)

  const [tab, setTab] = useState<Tab>('home')
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [animateKey, setAnimateKey] = useState(0)
  const [quickChatRequest, setQuickChatRequest] = useState(0)
  const compact = useCompactLayout()

  useReminderScheduler()
  const openNotes = () => setTab('notes')

  useEffect(() => listenForQuickChat(context => {
    if(context?.taskId&&context.date)focusNotification(context.taskId,context.date)
    setDetailTaskId(null)
    setListOpen(false)
    setTab('agent')
    setQuickChatRequest(value => value + 1)
  }), [])

  useEffect(() => {
    init()
    initAssistantSync()
    initCoachReminders()
    initDailyCoach()
  }, [init])

  // 主题色变化（用户在「更多→外观」切换）实时套用
  useEffect(() => {
    applyThemeColor(settings.themeColor || DEFAULT_THEME)
  }, [settings.themeColor])

  // 云同步：初始化防抖自动 push 管理器；启动时若已启用且已配置，静默 pull 一次
  useEffect(() => {
    initSyncManager()
    if (!Capacitor.isNativePlatform() && settings.cloudSyncEnabled && settings.supabaseUrl && settings.supabaseAnonKey) {
      // 后台静默拉取其它设备的新变更，不弹任何提示；失败也静默
      pullOnly(settings).then((r) => {
        if (r.ok && r.needReload) {
          ;(useStore as unknown as { getState: () => { reload: () => void } }).getState().reload()
        }
      })
    }
    // 仅在云同步开关或凭据变化时重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.cloudSyncEnabled, settings.supabaseUrl, settings.supabaseAnonKey])

  // 启动后把现有「开启提醒」的待办同步到系统日历（原生平台生效，Web 端 no-op）
  useEffect(() => {
    let timer:ReturnType<typeof setTimeout>
    const sync=()=>{
      clearTimeout(timer)
      timer=setTimeout(()=>{
      const state = useStore.getState()
      void syncTasksToCalendar(state.tasks, state.records).catch(() => {})
      },400)
    }
    const visible=()=>{if(document.visibilityState==='visible')sync()}
    sync()
    document.addEventListener('visibilitychange',visible)
    window.addEventListener('focus',sync)
    const unwatch=watchCalendarChanges(sync)
    return () => {unwatch();clearTimeout(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',sync)}
  }, [])

  useEffect(() => {
    setAnimateKey((k) => k + 1)
  }, [tab])

  // 监听 hash 路由（桌面小组件等外部深链）
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '')
      if (h.startsWith('task/')) {
        setDetailTaskId(h.slice(5))
        setTab('home')
      }
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const switchTab = (t: Tab) => {
    if (settings.hapticsEnabled) haptic('light')
    if (t === 'agent') setQuickChatRequest(value => value + 1)
    setTab(t)
  }

  if (!initialized) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">加载中…</div>
    )
  }

  return (
    <div className={`workbench-shell h-full w-full max-w-md mx-auto bg-[#F6F7FA] relative flex flex-col overflow-hidden ${compact ? 'is-compact' : ''}`}>
      <div className="flex-1 overflow-hidden relative">
        {detailTaskId ? (
          <div key="detail" className="absolute inset-0 animate-fade-in">
            <TaskDetailScreen
              taskId={detailTaskId}
              onBack={() => {
                setDetailTaskId(null)
                window.location.hash = ''
              }}
            />
          </div>
        ) : listOpen ? (
          <div key="list" className="absolute inset-0 animate-fade-in">
            <ListScreen onBack={() => setListOpen(false)} />
          </div>
        ) : (
          <div key={animateKey} className="absolute inset-0 animate-fade-in">
            {tab === 'home' && <HomeScreen compact={compact} onOpenAgent={Capacitor.isNativePlatform() ? () => switchTab('agent') : undefined} />}
            {tab === 'agent' && <AgentScreen compact={compact} quickChatRequest={quickChatRequest} />}
            {tab === 'account' && <AccountingScreen compact={compact} />}
            {tab === 'timeline' && <TimelineReviewScreen />}
            {tab === 'info' && <InfoScreen />}
            {tab === 'more' && <MoreScreen onOpenNotes={openNotes} onOpenList={() => setListOpen(true)} onNavigate={compact ? switchTab : undefined} />}
            {tab === 'notes' && <NotesScreen onBack={() => setTab('more')} />}
          </div>
        )}
      </div>

      {/* 外屏保留三个主入口，其余页面从更多进入。 */}
      {!detailTaskId && !listOpen && (
        <nav className="shrink-0 border-t border-gray-200 bg-white/95 backdrop-blur safe-area-pb relative">
          <div className="flex">
            {(compact && Capacitor.isNativePlatform() ? [TABS[0],{key:'agent' as const,label:'说话',icon:<Icons.Mic size={20}/>},TABS[4]] : TABS).map((t) => (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`nav-button ${tab === t.key ? 'nav-button-active' : ''} ${compact && t.key === 'agent' ? 'nav-voice' : ''}`}
              >
                <span className="relative">
                  {t.icon}
                  {tab === t.key && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </span>
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <ToastHost />
    </div>
  )
}
