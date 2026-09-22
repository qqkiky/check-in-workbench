import { useEffect, useState } from 'react'
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
import { syncTasksToCalendar } from './capacitor/task-calendar'
import { Icons } from './components/common/Icons'

type Tab = 'home' | 'account' | 'timeline' | 'info' | 'more' | 'notes'

// 底部主导航：Do(打卡) · 记账 · 回顾 · 资讯 · 更多（记账入口在「记账」Tab 内部，不再有中央 FAB）
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Do', icon: <Icons.Home size={20} /> },
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

  useReminderScheduler()
  const openNotes = () => setTab('notes')

  useEffect(() => {
    init()
  }, [init])

  // 主题色变化（用户在「更多→外观」切换）实时套用
  useEffect(() => {
    applyThemeColor(settings.themeColor || DEFAULT_THEME)
  }, [settings.themeColor])

  // 云同步：初始化防抖自动 push 管理器；启动时若已启用且已配置，静默 pull 一次
  useEffect(() => {
    initSyncManager()
    if (settings.cloudSyncEnabled && settings.supabaseUrl && settings.supabaseAnonKey) {
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
    const t = setTimeout(() => {
      void syncTasksToCalendar(useStore.getState().tasks)
    }, 800)
    return () => clearTimeout(t)
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
    setTab(t)
  }

  if (!initialized) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">加载中…</div>
    )
  }

  return (
    <div className="h-full w-full max-w-md mx-auto bg-[#F2F2F7] relative flex flex-col overflow-hidden">
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
            {tab === 'home' && <HomeScreen />}
            {tab === 'account' && <AccountingScreen />}
            {tab === 'timeline' && <TimelineReviewScreen />}
            {tab === 'info' && <InfoScreen />}
            {tab === 'more' && <MoreScreen onOpenNotes={openNotes} onOpenList={() => setListOpen(true)} />}
            {tab === 'notes' && <NotesScreen onBack={() => setTab('more')} />}
          </div>
        )}
      </div>

      {/* 底部 Tab Bar（4 项） */}
      {!detailTaskId && !listOpen && (
        <nav className="shrink-0 border-t border-gray-200 bg-white/95 backdrop-blur safe-area-pb relative">
          <div className="flex">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`nav-button ${tab === t.key ? 'nav-button-active' : ''}`}
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
