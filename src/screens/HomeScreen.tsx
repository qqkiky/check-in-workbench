import { useMemo, useState, useEffect } from 'react'
import { useStore } from '@/store'
import { TaskCard } from '@/components/tasks/TaskCard'
import { Icons } from '@/components/common/Icons'
import { dt, fmtDate, getLunarDay } from '@/utils/date'
import { showToast } from '@/components/common/Toast'
import { Modal } from '@/components/common/Modal'
import { TaskFormModal } from '@/components/tasks/TaskFormModal'
import { CheckInTimeModal, shiftMinutes } from '@/components/tasks/CheckInTimeModal'
import { TodayTimeline } from '@/components/timeline/TodayTimeline'
import { TimelineNoteModal } from '@/components/timeline/TimelineNoteModal'
import { getUpcomingEvents, daysUntil } from '@/utils/events'
import type { Task, Category, CheckInRecord, TimelineEntry } from '@/types'
import { APP_NAME } from '@/types'
import { APP_VERSION } from '@/version'

type DayTab = 'today' | 'week' | 'quick'

export function HomeScreen() {
  const {
    tasks,
    categories,
    records,
    timelineEntries,
    addRecord,
    addTask,
    archiveTask,
    deleteRecord,
    addTimelineNote,
    updateTimelineEntry,
    deleteTimelineEntry,
    updateSettings,
    settings,
  } = useStore()
  const today = useMemo(() => new Date(), [])
  const [viewMode, setViewMode] = useState<DayTab>('today')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [showEvents, setShowEvents] = useState(false)
  const [defaultScheduledDate, setDefaultScheduledDate] = useState<string | undefined>(undefined)
  // 周视图点某天后跳转到的「那一天」；为 null 表示看今天
  const [focusDate, setFocusDate] = useState<Date | null>(null)
  // 打卡时弹出的「时间选择」暂存（选好起止时间后写入记录）
  const [pendingCheckIn, setPendingCheckIn] = useState<{
    taskId: string
    dateKey: string
    defaultStart: string
    defaultEnd: string
  } | null>(null)
  // 时间线（日历记事本）开关与「记一笔」弹窗
  const [showTimeline, setShowTimeline] = useState<boolean>(settings.showTimeline ?? true)
  const [noteModal, setNoteModal] = useState<{ date: string; startTime: string; entry?: TimelineEntry } | null>(null)

  const toggleTimeline = (next: boolean) => {
    setShowTimeline(next)
    updateSettings({ showTimeline: next })
  }

  // ===== 日视图：聚焦某天（默认今天）的任务 =====
  const viewDate = focusDate ?? today
  const viewDateKey = fmtDate(viewDate)
  // 时间线跨天浏览：独立日期（默认跟随日视图聚焦日，可通过时间线内导航切换）
  const [timelineDate, setTimelineDate] = useState<string>(viewDateKey)
  useEffect(() => {
    setTimelineDate(viewDateKey)
  }, [viewDateKey])
  const upcomingEvents = useMemo(() => getUpcomingEvents(today, 120), [today])
  // 未来的事件（按日期升序，第一个即最近），供左上角时钟角标与弹层使用
  const futureEvents = useMemo(
    () =>
      upcomingEvents
        .filter((e) => {
          if (!e.date) return false
          return daysUntil(today, e.date) > 0
        })
        .slice(0, 8),
    [upcomingEvents, today]
  )
  const nearestEventDays =
    futureEvents.length > 0 && futureEvents[0].date
      ? daysUntil(today, futureEvents[0].date)
      : null

  // ===== 周视图：可按周偏移查看任意过往周次 =====
  const weekStart = useMemo(() => dt.startOfWeek(today, 1), [today])
  const weekDates = useMemo(() => {
    const arr: Date[] = []
    for (let i = 0; i < 7; i++) arr.push(dt.addDays(weekStart, i))
    return arr
  }, [weekStart])
  const weekDateKeys = useMemo(() => weekDates.map(fmtDate), [weekDates])

  // 把任务展开成本周各天的实例（用于周视图分组）
  // - 每周重复（weekdays）→ 按星期几展开到本周匹配日
  // - 每月重复（monthDay）→ 本周内「几号」命中的那天
  // - 每日重复 → 展开到本周每一天
  // - 一次性任务有 scheduledDate 且在本周 → 落在该天；否则归到今天
  const weekTaskInstances = useMemo(() => {
    const out: Array<{ task: Task; dateKey: string }> = []
    for (const t of tasks) {
      if (t.archivedAt || t.isQuick) continue
      if (t.recurrence === 'weekly' && t.weekdays && t.weekdays.length) {
        for (const d of weekDates) {
          if (t.weekdays.includes(d.getDay())) out.push({ task: t, dateKey: fmtDate(d) })
        }
        continue
      }
      if (t.recurrence === 'monthly' && t.monthDay) {
        for (const d of weekDates) {
          if (d.getDate() === t.monthDay) out.push({ task: t, dateKey: fmtDate(d) })
        }
        continue
      }
      if (t.recurrence === 'daily') {
        for (const d of weekDates) out.push({ task: t, dateKey: fmtDate(d) })
        continue
      }
      // 不重复（一次性）
      if (t.scheduledDate && weekDateKeys.includes(t.scheduledDate)) {
        out.push({ task: t, dateKey: t.scheduledDate })
        continue
      }
      // 无明确日期的一次性任务：归入所查看周的周一（保证在查看过往周时也能出现）
      out.push({ task: t, dateKey: fmtDate(weekDates[0]) })
    }
    return out
  }, [tasks, weekDates, weekDateKeys, today])

  const weekGrouped = useMemo(() => {
    const groups: Record<string, Array<Task & { completed: boolean; record?: CheckInRecord }>> = {}
    for (const d of weekDateKeys) groups[d] = []
    for (const { task, dateKey } of weekTaskInstances) {
      if (groups[dateKey]) {
        const rec = records.find((r) => r.taskId === task.id && r.date === dateKey)
        // 关键：必须带上 record，否则 TaskCard 的「已完成」分支
        // （ if (task.completed && task.record) ）会因 record 缺失而跳过，
        // 导致周视图里打卡过的任务仍显示为「未完成」。日/周同步依赖这一点。
        groups[dateKey].push({ ...task, completed: !!rec, record: rec })
      }
    }
    return groups
  }, [weekTaskInstances, weekDateKeys, records])

  // 日视图（任意聚焦日期）的任务 = 周分组中属于该日期的实例，保证与周视图完全一致
  const dayInstances = useMemo(
    () => weekTaskInstances.filter((i) => i.dateKey === viewDateKey),
    [weekTaskInstances, viewDateKey]
  )
  const dayTasks = useMemo(
    () =>
      dayInstances
        .map(({ task }) => ({
          ...task,
          completed: records.some((r) => r.taskId === task.id && r.date === viewDateKey),
          record: records.find((r) => r.taskId === task.id && r.date === viewDateKey),
        }))
        .sort((a, b) =>
          (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99')
        ),
    [dayInstances, records, viewDateKey, today]
  )

  // ===== 公共 =====
  const quickTasks = useMemo(
    () => tasks.filter((t) => t.isQuick && !t.archivedAt),
    [tasks]
  )

  // done=true 表示当前已打卡（用于取消）；dateKey 为该任务实例所属的那一天
  const handleCheckIn = (taskId: string, done: boolean, dateKey: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    if (done) {
      // 取消打卡：删除该日期的对应记录
      const rec = records.find((r) => r.taskId === taskId && r.date === dateKey)
      if (rec) {
        deleteRecord(rec.id)
        showToast('已取消打卡')
      }
      return
    }
    // 小事：轻量打卡，不弹时间选择
    if (task.isQuick) {
      doCheckIn(task, dateKey, null, null)
      return
    }
    // 普通任务：弹出时间选择，录入「日期 + 起止时间」用于「今日时间线」计算时长
    const now = new Date()
    const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const isPast = dateKey < fmtDate(today)
    // 补卡（过去日）：默认用计划时间预填合理时段；当天打卡默认用当前时间
    const defaultStart = task.scheduledTime || (isPast ? '09:00' : nowHHmm)
    const defaultEnd = isPast
      ? task.scheduledTime
        ? shiftMinutes(task.scheduledTime, 30)
        : '09:30'
      : nowHHmm
    setPendingCheckIn({ taskId, dateKey, defaultStart, defaultEnd })
  }

  // 写入一条打卡记录；start/end 为 HH:mm（小事为 null → 仅记录完成时间，时长为 0）
  const doCheckIn = (task: Task, dateKey: string, start: string | null, end: string | null) => {
    let startedAt: number | undefined
    let completedAt = Date.now()
    let durationSeconds = 0
    if (start && end) {
      const [sh, sm] = start.split(':').map(Number)
      const [eh, em] = end.split(':').map(Number)
      const [Y, M, D] = dateKey.split('-').map(Number)
      startedAt = new Date(Y, M - 1, D, sh, sm, 0, 0).getTime()
      completedAt = new Date(Y, M - 1, D, eh, em, 0, 0).getTime()
      if (completedAt < startedAt) {
        // 跨天：结束时间视为次日（若开始=结束，则同一分钟内完成，时长为 0）
        completedAt += 24 * 60 * 60 * 1000
      }
      durationSeconds = Math.max(0, Math.round((completedAt - startedAt) / 1000))
    }
    addRecord({
      taskId: task.id,
      taskTitle: task.title,
      categoryId: task.categoryId,
      date: dateKey,
      startedAt,
      completedAt,
      durationSeconds,
      progress: task.target ? Math.min(task.target, 1) : undefined,
      progressTotal: task.target,
      isMakeup: dateKey < fmtDate(today),
      makeupAt: dateKey < fmtDate(today) ? Date.now() : undefined,
    })
    showToast('✓ 已打卡')
  }

  // 时间选择弹窗确认（date 为用户所选完成日期，补卡时可不同于计划日）
  const confirmCheckIn = (start: string, end: string, date: string) => {
    if (!pendingCheckIn) return
    const task = tasks.find((t) => t.id === pendingCheckIn.taskId)
    setPendingCheckIn(null)
    if (task) doCheckIn(task, date, start, end)
  }

  const addQuick = () => {
    if (!quickText.trim()) return
    addTask({
      title: quickText.trim(),
      categoryId: 'life',
      recurrence: 'none',
      isQuick: true,
      scheduledTime: undefined,
    })
    setQuickText('')
    showToast('已添加小事')
  }

  // 周视图点某一天 → 跳转到那一天的日视图（而非直接新建）
  const handlePickDate = (dateKey: string) => {
    const d = weekDates.find((x) => fmtDate(x) === dateKey) ?? new Date(dateKey)
    setFocusDate(d)
    setViewMode('today')
  }

  // 新增任务：若在聚焦某天的日视图下，默认带出该日期
  const openAdd = () => {
    setEditingTaskId(null)
    setDefaultScheduledDate(focusDate ? fmtDate(focusDate) : undefined)
    setShowForm(true)
  }

  // ===== 时间线跨天浏览 =====
  const timelinePrevDay = () => {
    const d = dt.addDays(new Date(timelineDate + 'T00:00:00'), -1)
    setTimelineDate(fmtDate(d))
  }
  const timelineNextDay = () => {
    const d = dt.addDays(new Date(timelineDate + 'T00:00:00'), 1)
    setTimelineDate(fmtDate(d))
  }
  const timelinePickDate = (k: string) => setTimelineDate(k)
  const openAddNote = () => {
    const isToday = timelineDate === fmtDate(today)
    const nowHHmm = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    setNoteModal({ date: timelineDate, startTime: isToday ? nowHHmm : '09:00' })
  }
  const openEditNote = (entry: TimelineEntry) => {
    setNoteModal({ date: entry.date, startTime: entry.startTime, entry })
  }

  const viewTabs: { key: DayTab; label: string; icon?: React.ReactNode }[] = [
    { key: 'today', label: '日' },
    { key: 'week', label: '周' },
    { key: 'quick', label: '小事' },
  ]

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowEvents(true)}
            className="relative w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary active:scale-95"
            aria-label="查看即将到来的节气与节日"
          >
            <Icons.Clock size={18} />
            {nearestEventDays != null && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                {nearestEventDays}天
              </span>
            )}
          </button>
          <div className="text-2xl font-light tracking-tight text-gray-900">{APP_NAME}</div>
          <button
            onClick={openAdd}
            className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center text-primary text-xl active:scale-95"
            aria-label="新增任务"
          >
            +
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{dt.format(today, 'EEEE')}</span>
            <span>{dt.format(today, 'yyyy/MM/dd')}</span>
            <span className="text-gray-400">{getLunarDay(today)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex bg-gray-100 rounded-full p-0.5">
            {viewTabs.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setViewMode(m.key)
                  setFocusDate(null)
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  viewMode === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {viewMode === 'today' && (
            <span className="text-[11px] text-gray-400">
              {dayTasks.filter((t) => t.completed).length}/{dayTasks.length} 已完成
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-24">
        {viewMode === 'today' && (
          <TodayView
            dayTasks={dayTasks}
            records={records}
            entries={timelineEntries}
            categories={categories}
            viewDate={viewDate}
            viewDateKey={viewDateKey}
            focused={focusDate !== null}
            showTimeline={showTimeline}
            onToggleTimeline={toggleTimeline}
            onAddNote={openAddNote}
            onDeleteEntry={deleteTimelineEntry}
            onEditEntry={openEditNote}
            onPrevDay={timelinePrevDay}
            onNextDay={timelineNextDay}
            onPickDate={timelinePickDate}
            timelineDate={timelineDate}
            onCheckIn={(taskId, done) => handleCheckIn(taskId, done, viewDateKey)}
            onAdd={openAdd}
            onBack={() => {
              setFocusDate(null)
              setViewMode('week')
            }}
            onArchive={(id) => {
              archiveTask(id)
              showToast('已归档')
            }}
            onEdit={(id) => {
              setEditingTaskId(id)
              setShowForm(true)
            }}
          />
        )}

        {viewMode === 'week' && (
          <WeekView
            weekStart={weekStart}
            weekDates={weekDates}
            weekDateKeys={weekDateKeys}
            today={today}
            grouped={weekGrouped}
            categories={categories}
            onCheckIn={handleCheckIn}
            onArchive={(id) => {
              archiveTask(id)
              showToast('已归档')
            }}
            onEdit={(id) => {
              setEditingTaskId(id)
              setShowForm(true)
            }}
            onAdd={() => setShowForm(true)}
            onPickDate={handlePickDate}
          />
        )}

        {viewMode === 'quick' && (
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-3">
              <input
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addQuick()}
                placeholder="记一件小事，回车添加"
                className="flex-1 px-4 py-2.5 rounded-full bg-white shadow-card text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={addQuick}
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center active:scale-95 shrink-0"
                aria-label="添加小事"
              >
                +
              </button>
            </div>
            {quickTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-300">
                  <Icons.Sparkles size={28} />
                </div>
                <p className="text-sm">还没有小事，随手记一件吧</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quickTasks.map((t) => (
                  <QuickItem
                    key={t.id}
                    id={t.id}
                    title={t.title}
                    done={!!records.find((r) => r.taskId === t.id && r.date === fmtDate(new Date()))}
                    onToggle={(done) => handleCheckIn(t.id, done, fmtDate(new Date()))}
                    onArchive={() => {
                      archiveTask(t.id)
                      showToast('已归档')
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-4 pb-2 text-center text-[10px] text-gray-300">打卡 v {APP_VERSION}</div>
      </div>

      <TaskFormModal
        open={showForm}
        taskId={editingTaskId}
        defaultScheduledDate={defaultScheduledDate}
        onClose={() => {
          setShowForm(false)
          setEditingTaskId(null)
          setDefaultScheduledDate(undefined)
        }}
      />

      {/* 打卡时间选择：录入起止时间用于今日时间线计算时长 */}
      <CheckInTimeModal
        open={!!pendingCheckIn}
        taskTitle={pendingCheckIn ? (tasks.find((t) => t.id === pendingCheckIn.taskId)?.title ?? '') : ''}
        defaultDate={pendingCheckIn?.dateKey || fmtDate(today)}
        defaultStart={pendingCheckIn?.defaultStart || '09:00'}
        defaultEnd={pendingCheckIn?.defaultEnd || '09:30'}
        onClose={() => setPendingCheckIn(null)}
        onConfirm={confirmCheckIn}
      />

      {/* 时间线「记一笔 / 编辑记事」：手写非打卡内容，支持起止时间 */}
      <TimelineNoteModal
        open={!!noteModal}
        editEntry={noteModal?.entry ?? null}
        defaultDate={noteModal?.date || fmtDate(today)}
        defaultStartTime={noteModal?.startTime || '09:00'}
        categories={categories}
        onClose={() => setNoteModal(null)}
        onConfirm={(data) => {
          if (data.id) {
            updateTimelineEntry(data.id, {
              startTime: data.startTime,
              endTime: data.endTime,
              content: data.content,
              categoryId: data.categoryId,
            })
            showToast('已更新记事')
          } else {
            addTimelineNote(data)
            showToast('已记录到时间线')
          }
        }}
      />

      {/* 左上角时钟：即将到来的节气 / 节日倒计时 */}
      <Modal open={showEvents} onClose={() => setShowEvents(false)} title="即将到来">
        <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100">
          {futureEvents.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">最近没有节日 / 节气</div>
          ) : (
            futureEvents.map((e, i) => {
              if (!e.date) return null
              const days = daysUntil(today, e.date)
              const [y, m, d] = e.date.split('-').map(Number)
              const eDate = new Date(y, m - 1, d)
              const subLabel = `${getLunarDay(eDate) || dt.format(eDate, 'MM月dd日')} | ${dt.format(eDate, 'EEEE')}`
              return (
                <div key={`${e.date}-${e.name}-${i}`} className="flex items-center px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-gray-900">{e.name}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{subLabel}</div>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <div className="text-2xl font-light text-gray-900 leading-none">{days}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">天后</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <p className="mt-3 text-[11px] text-gray-400 text-center">未来 120 天内的节气与节日</p>
      </Modal>
    </div>
  )
}

// ============== 日视图组件（可展示任意聚焦日期） ==============
function TodayView({
  dayTasks,
  records,
  entries,
  categories,
  viewDate,
  viewDateKey,
  focused,
  showTimeline,
  onToggleTimeline,
  onAddNote,
  onDeleteEntry,
  onEditEntry,
  onPrevDay,
  onNextDay,
  onPickDate,
  timelineDate,
  onCheckIn,
  onArchive,
  onEdit,
  onAdd,
  onBack,
}: {
  dayTasks: Array<Task & { completed: boolean; record?: any; checkInState?: 'normal' | 'makeup' | 'makeup-expired' }>
  records: CheckInRecord[]
  entries: TimelineEntry[]
  categories: Category[]
  viewDate: Date
  viewDateKey: string
  focused: boolean
  showTimeline: boolean
  onToggleTimeline: (next: boolean) => void
  onAddNote: () => void
  onDeleteEntry: (id: string) => void
  onEditEntry: (entry: TimelineEntry) => void
  onPrevDay: () => void
  onNextDay: () => void
  onPickDate: (date: string) => void
  timelineDate: string
  onCheckIn: (id: string, done: boolean) => void
  onArchive: (id: string) => void
  onEdit: (id: string) => void
  onAdd: () => void
  onBack: () => void
}) {
  return (
    <>
      {/* 聚焦某天时显示返回条 */}
      {focused && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white shadow-card text-sm text-gray-700 active:scale-95"
            aria-label="返回周视图"
          >
            <Icons.ChevronLeft size={16} /> 返回周
          </button>
          <span className="text-sm font-semibold text-gray-800">
            {dt.format(viewDate, 'MM月dd日')} {dt.format(viewDate, 'EEEE')}
          </span>
          <span className="text-[11px] text-gray-400">{getLunarDay(viewDate)}</span>
        </div>
      )}

      {/* 待办 */}
      <div className="mt-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-800">
            {focused ? '当日待办' : '今日待办'}
          </h3>
          <div className="flex items-center gap-2">
            {/* 时间线开关：在「今日待办」旁提供可选项 */}
            <button
              onClick={() => onToggleTimeline(!showTimeline)}
              className="flex items-center gap-1.5 text-[11px] active:scale-95"
              aria-pressed={showTimeline}
            >
              <span className={`w-8 h-5 rounded-full transition-colors relative ${showTimeline ? 'bg-primary' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${showTimeline ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
              <span className={showTimeline ? 'text-primary' : 'text-gray-400'}>时间线</span>
            </button>
            <span className="text-[10px] text-gray-400">{viewDateKey}</span>
          </div>
        </div>
        {dayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl shadow-card text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-300">
              <Icons.Calendar size={28} />
            </div>
            <p className="text-sm">这一天还没有待办</p>
            <button
              onClick={onAdd}
              className="mt-3 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium active:scale-95"
            >
              添加一个
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dayTasks.map((task) => {
              const cat = categories.find((c) => c.id === task.categoryId)
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  category={cat}
                  taskDate={viewDateKey}
                  onCheckIn={() => onCheckIn(task.id, task.completed)}
                  onArchive={() => onArchive(task.id)}
                  onDetail={() => onEdit(task.id)}
                />
              )
            })}
          </div>
        )}

        {/* 当日时间线（日历记事本）：打卡内容自动汇入 + 可手写非打卡内容 + 跨天浏览 */}
        {showTimeline && (
          <TodayTimeline
            records={records}
            entries={entries}
            categories={categories}
            dateKey={timelineDate}
            title="时间线"
            onAddNote={onAddNote}
            onDeleteEntry={onDeleteEntry}
            onEditEntry={onEditEntry}
            onPrevDay={onPrevDay}
            onNextDay={onNextDay}
            onPickDate={onPickDate}
          />
        )}
      </div>
    </>
  )
}

// ============== 周视图组件 ==============
function WeekView({
  weekStart,
  weekDates,
  weekDateKeys,
  today,
  grouped,
  categories,
  onCheckIn,
  onArchive,
  onEdit,
  onAdd,
  onPickDate,
}: {
  weekStart: Date
  weekDates: Date[]
  weekDateKeys: string[]
  today: Date
  grouped: Record<string, Array<Task & { completed: boolean }>>
  categories: Category[]
  onCheckIn: (id: string, done: boolean, dateKey: string) => void
  onArchive: (id: string) => void
  onEdit: (id: string) => void
  onAdd: () => void
  onPickDate?: (dateKey: string) => void
}) {
  const todayKey = fmtDate(today)
  const totalCount = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)
  const doneCount = weekDateKeys.reduce(
    (s, k) => s + (grouped[k] || []).filter((t) => t.completed).length,
    0
  )

  // 把图2顶部星期表头的数据预计算
  const weekDayLabels = ['一', '二', '三', '四', '五', '六', '日']

  return (
    <>
      {/* 周表头（参考图2）—— 点击某天跳转到那一天 */}
      <div className="mt-3 bg-white rounded-2xl shadow-card">
        <div className="grid grid-cols-7 text-center py-2">
          {weekDates.map((d, i) => {
            const k = fmtDate(d)
            const isToday = k === todayKey
            const isWeekend = i >= 5
            const items = grouped[k] || []
            const itemsCount = items.length
            const isPastDay = d < today && !isToday
            const doneForDay = items.filter((t) => t.completed).length
            const makeupCount = isPastDay ? itemsCount - doneForDay : 0
            return (
              <button
                key={k}
                onClick={() => onPickDate?.(k)}
                className="flex flex-col items-center active:scale-95 transition"
                aria-label={`查看 ${dt.format(d, 'MM月dd日')} 的任务`}
              >
                <div className={`text-[10px] mb-0.5 ${isToday ? 'text-primary font-semibold' : 'text-gray-500'}`}>
                  {weekDayLabels[i]}
                </div>
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-semibold ${
                    isToday
                      ? 'bg-primary text-white'
                      : isWeekend
                      ? 'text-red-500'
                      : 'text-gray-900'
                  }`}
                >
                  {d.getDate()}
                </div>
                {isPastDay && makeupCount > 0 ? (
                  <div className="mt-0.5 text-[9px] font-semibold text-orange-500">补{makeupCount}</div>
                ) : (
                  <div className={`mt-0.5 text-[9px] ${itemsCount > 0 ? 'text-primary' : 'text-gray-300'}`}>
                    {itemsCount > 0 ? itemsCount : '·'}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 进度概览 */}
      <div className="mt-2 px-2 text-[11px] text-gray-500 flex items-center justify-between">
        <span>本周 {doneCount}/{totalCount} 已完成</span>
        <button
          onClick={onAdd}
          className="text-primary active:scale-95"
          aria-label="新增任务"
        >
          + 新增
        </button>
      </div>

      {/* 按天分组的任务列表 */}
      <div className="mt-2 space-y-3">
        {weekDates.map((d) => {
          const k = fmtDate(d)
          const items = grouped[k] || []
          const isToday = k === todayKey
          const isPast = d < today && !isToday
          return (
            <div key={k} className={`bg-white rounded-2xl shadow-card overflow-hidden ${isToday ? 'ring-1 ring-primary/30' : ''}`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      isToday ? 'text-primary' : isPast ? 'text-gray-400' : 'text-gray-700'
                    }`}
                  >
                    {isToday ? '今天' : dt.format(d, 'MM/dd')}
                  </span>
                  <span className="text-[10px] text-gray-400">{dt.format(d, 'EEEE')}</span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {items.filter((i) => i.completed).length}/{items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <div className="px-3 py-4 text-[12px] text-gray-300 text-center">无任务</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {items.map((task) => {
                    const cat = categories.find((c) => c.id === task.categoryId)
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        category={cat}
                        taskDate={k}
                        compact
                        onCheckIn={() => onCheckIn(task.id, task.completed, k)}
                        onArchive={() => onArchive(task.id)}
                        onDetail={() => onEdit(task.id)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {totalCount === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl shadow-card text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-300">
              <Icons.Calendar size={28} />
            </div>
            <p className="text-sm">本周还没有任务</p>
            <button
              onClick={onAdd}
              className="mt-3 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium active:scale-95"
            >
              添加一个
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ============== 小事项 ==============
function QuickItem({
  id,
  title,
  done,
  onToggle,
  onArchive,
}: {
  id: string
  title: string
  done: boolean
  onToggle: (done: boolean) => void
  onArchive: () => void
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-card">
      <button
        onClick={() => onToggle(done)}
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors active:scale-95 ${
          done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent'
        }`}
        aria-label={done ? '取消完成' : '标记完成'}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <span className={`flex-1 text-[15px] ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{title}</span>
      <button
        onClick={onArchive}
        className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center active:scale-95 shrink-0"
        aria-label="归档小事"
      >
        <Icons.Archive size={15} />
      </button>
    </div>
  )
}
