import { TextInput } from '@/components/common/TextField'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { dt, fmtDate, getLunarDay } from '@/utils/date'
import { showActionToast, showToast } from '@/components/common/Toast'
import { Modal } from '@/components/common/Modal'
import { TaskFormModal } from '@/components/tasks/TaskFormModal'
import { CheckInTimeModal, shiftMinutes } from '@/components/tasks/CheckInTimeModal'
import { TodayTimeline } from '@/components/timeline/TodayTimeline'
import { TimelineNoteModal } from '@/components/timeline/TimelineNoteModal'
import { getUpcomingEvents, daysUntil } from '@/utils/events'
import type { Task, Category, CheckInRecord, TimelineEntry } from '@/types'
import { APP_NAME } from '@/types'
import { APP_VERSION } from '@/version'
import { TodayAgenda } from '@/components/tasks/TodayAgenda'
import { buildTodayAgenda } from '@/services/todayAgenda'
import { taskOccursOnDate } from '@/utils/recurrence'
import { checkInTimes, isNextDay } from '@/utils/checkIn'

type DayTab = 'today' | 'week' | 'quick'

export function HomeScreen({compact=false,onOpenAgent}:{compact?:boolean;onOpenAgent?:()=>void}) {
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
  } = useStore()
  const [clock,setClock] = useState(() => new Date())
  const today = useMemo(() => dt.startOfDay(clock), [fmtDate(clock)])
  useEffect(() => { const timer=setInterval(() => setClock(new Date()),30000); return () => clearInterval(timer) }, [])
  const [viewMode, setViewMode] = useState<DayTab>('today')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [showEvents, setShowEvents] = useState(false)
  const [defaultScheduledDate, setDefaultScheduledDate] = useState<string | undefined>(undefined)
  // 日、周和时间线共用所查看的日期；为 null 表示看今天
  const [focusDate, setFocusDate] = useState<Date | null>(null)
  // 打卡时弹出的「时间选择」暂存（选好起止时间后写入记录）
  const [pendingCheckIn, setPendingCheckIn] = useState<{
    taskId: string
    dateKey: string
    startDate: string
    defaultStart: string
    defaultEnd: string
  } | null>(null)
  // 时间线（日历记事本）开关与「记一笔」弹窗
  const [showTimeline, setShowTimeline] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [noteModal, setNoteModal] = useState<{ date: string; startTime: string; entry?: TimelineEntry } | null>(null)

  const toggleTimeline = (next: boolean) => {
    setShowTimeline(next)
    updateSettings({ showTimeline: next })
  }

  // ===== 日视图：聚焦某天（默认今天）的任务 =====
  const viewDate = focusDate ?? today
  const viewDateKey = fmtDate(viewDate)
  const timelineDate = viewDateKey
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

  // ===== 周视图：跟随所查看日期所在的周 =====
  const weekStart = useMemo(() => dt.startOfWeek(viewDate, 1), [viewDate])
  const isCurrentWeek = fmtDate(weekStart) === fmtDate(dt.startOfWeek(today, 1))
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
  // - 指定日期的一次性任务只在所属周显示
  const weekTaskInstances = useMemo(() => {
    const out: Array<{ task: Task; dateKey: string }> = []
    for (const t of tasks) {
      if (t.archivedAt || t.isQuick) continue
      if (t.recurrence === 'weekly' && t.weekdays && t.weekdays.length) {
        for (const d of weekDates) {
          if (taskOccursOnDate(t,d)) out.push({ task: t, dateKey: fmtDate(d) })
        }
        continue
      }
      if (t.recurrence === 'monthly' && t.monthDay) {
        for (const d of weekDates) {
          if (taskOccursOnDate(t,d)) out.push({ task: t, dateKey: fmtDate(d) })
        }
        continue
      }
      if (t.recurrence === 'daily') {
        for (const d of weekDates) if(taskOccursOnDate(t,d)) out.push({ task: t, dateKey: fmtDate(d) })
        continue
      }
      // 不重复（一次性）
      if (t.scheduledDate) {
        if (weekDateKeys.includes(t.scheduledDate)) out.push({ task: t, dateKey: t.scheduledDate })
        continue
      }
      // 无明确日期的一次性任务：归入所查看周的周一（保证在查看过往周时也能出现）
      out.push({ task: t, dateKey: fmtDate(weekDates[0]) })
    }
    return out
  }, [tasks, weekDates, weekDateKeys, today])

  const weekGrouped = useMemo(() => {
    const groups: Record<string, Array<{ task: Task; record?: CheckInRecord }>> = {}
    for (const d of weekDateKeys) groups[d] = []
    for (const { task, dateKey } of weekTaskInstances) {
      if (groups[dateKey]) {
        const rec = records.find((r) => r.taskId === task.id && r.date === dateKey)
        groups[dateKey].push({ task, record: rec })
      }
    }
    for (const items of Object.values(groups)) {
      items.sort((a,b) => (a.task.scheduledTime || '99:99').localeCompare(b.task.scheduledTime || '99:99'))
    }
    return groups
  }, [weekTaskInstances, weekDateKeys, records])

  const agenda = useMemo(() => buildTodayAgenda(tasks,records,viewDate,clock), [tasks,records,viewDate,clock])

  // ===== 公共 =====
  const quickTasks = useMemo(
    () => tasks.filter((t) => t.isQuick && !t.archivedAt),
    [tasks]
  )

  const handleSkip = (taskId: string, dateKey: string) => {
    const state = useStore.getState()
    const task = state.tasks.find(item => item.id === taskId)
    if (!task || task.recurrence === 'none' || dateKey < fmtDate(new Date())) return
    if (!taskOccursOnDate(task, new Date(dateKey + 'T00:00:00'))) return
    if (state.records.some(record => record.taskId === taskId && record.date === dateKey)) return

    state.updateTask(taskId, { excludedDates: [...(task.excludedDates || []), dateKey].sort() })
    showActionToast({
      message: `已跳过 ${dateKey.slice(5)} 的「${task.title}」`,
      actionText: '撤销',
      onAction: () => {
        const current = useStore.getState()
        const latest = current.tasks.find(item => item.id === taskId)
        if (!latest?.excludedDates?.includes(dateKey)) return
        current.updateTask(taskId, { excludedDates: latest.excludedDates.filter(day => day !== dateKey) })
      },
    })
  }

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
    const todayKey = fmtDate(now)
    const isCarry = viewMode === 'today' && viewDateKey === todayKey && task.recurrence === 'none' && dateKey < todayKey
    const overnight = now.getHours() < 6 && isNextDay(now,dateKey)
    const hadEveningPlan = overnight && !!task.scheduledTime && task.scheduledTime >= '18:00'
    const startDate = hadEveningPlan ? dateKey : isCarry || overnight ? todayKey : dateKey
    const usePlannedTimes = startDate !== todayKey && !overnight
    const plannedStart = task.scheduledTime || '09:00'
    const defaultStart = usePlannedTimes || hadEveningPlan || (plannedStart <= nowHHmm && task.scheduledTime)
      ? plannedStart
      : nowHHmm
    const defaultEnd = usePlannedTimes ? shiftMinutes(defaultStart,30) : nowHHmm
    setPendingCheckIn({ taskId, dateKey, startDate, defaultStart, defaultEnd })
  }

  const doCheckIn = (task: Task, dateKey: string, start: string | null, end: string | null, startDate = dateKey, title = task.title) => {
    const { startedAt, completedAt, durationSeconds } = start && end
      ? checkInTimes(startDate,start,end)
      : { startedAt:undefined, completedAt:Date.now(), durationSeconds:0 }
    const now = new Date()
    const isCarry = viewMode === 'today' && viewDateKey === fmtDate(now) && task.recurrence === 'none' && dateKey < viewDateKey
    const keepOccurrenceDate = isNextDay(new Date(completedAt),dateKey) && (
      !isCarry || startDate === dateKey || now.getHours() < 6
    )
    addRecord({
      taskId: task.id,
      taskTitle: title,
      categoryId: task.categoryId,
      date: dateKey,
      startedAt,
      completedAt,
      durationSeconds,
      ...(keepOccurrenceDate ? { keepOccurrenceDate } : {}),
      progress: task.target ? Math.min(task.target, 1) : undefined,
      progressTotal: task.target,
      isMakeup: dateKey < fmtDate(today),
      makeupAt: dateKey < fmtDate(today) ? Date.now() : undefined,
    })
    showToast('✓ 已打卡')
  }

  const confirmCheckIn = (start: string, end: string, startDate: string, title: string) => {
    if (!pendingCheckIn) return
    const task = tasks.find((t) => t.id === pendingCheckIn.taskId)
    setPendingCheckIn(null)
    if (task) doCheckIn(task, pendingCheckIn.dateKey, start, end, startDate, title)
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

  const changeDate = (dateKey: string) => {
    if (dateKey) setFocusDate(dateKey === fmtDate(today) ? null : new Date(dateKey + 'T00:00:00'))
  }
  const shiftViewDate = (days: number) => changeDate(fmtDate(dt.addDays(viewDate, days)))

  // 周视图点某一天 → 跳转到那一天的日视图（而非直接新建）
  const handlePickDate = (dateKey: string) => {
    changeDate(dateKey)
    setViewMode('today')
  }

  // 新增任务：若在聚焦某天的日视图下，默认带出该日期
  const openAdd = () => {
    setEditingTaskId(null)
    setDefaultScheduledDate(focusDate ? fmtDate(focusDate) : undefined)
    setShowForm(true)
  }

  // ===== 时间线跨天浏览 =====
  const timelinePrevDay = () => shiftViewDate(-1)
  const timelineNextDay = () => shiftViewDate(1)
  const timelinePickDate = changeDate
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
      <header className="agenda-header">
        <button className="agenda-brand" onClick={() => setShowEvents(true)} aria-label="查看即将到来的节气与节日">{APP_NAME}</button>
        <div className="agenda-title-row">
          <h1>{viewMode === 'quick' ? '小事' : viewMode === 'week' ? (isCurrentWeek ? '本周规划' : '周规划') : viewDateKey === fmtDate(today) ? '今天' : dt.format(viewDate, 'MM月dd日')}{viewMode !== 'week' && <span className="agenda-cover-date"> · {dt.format(viewDate, 'MM/dd')}</span>}</h1>
          <div className="flex items-center gap-1">
            <button className="agenda-header-action" onClick={() => setShowDatePicker(true)} aria-label="切换日期与视图"><Icons.Calendar size={20}/></button>
            <button className="agenda-header-action text-primary" onClick={openAdd} aria-label="新增任务">＋</button>
          </div>
        </div>
        <div className={`agenda-date-browse ${viewMode === 'week' ? 'agenda-week-dates' : ''}`}>
          <button onClick={() => shiftViewDate(viewMode === 'week' ? -7 : -1)} aria-label={viewMode === 'week' ? '上一周' : '上一天'}><Icons.ChevronLeft size={16}/></button>
          <button className="agenda-date-label" onClick={() => setShowDatePicker(true)}>{viewMode === 'week' ? `${dt.format(weekStart, 'MM/dd')} – ${dt.format(weekDates[6], 'MM/dd')}` : `${dt.format(viewDate, 'MM月dd日')} ${dt.format(viewDate, 'EEEE')}`}</button>
          <button onClick={() => shiftViewDate(viewMode === 'week' ? 7 : 1)} aria-label={viewMode === 'week' ? '下一周' : '下一天'}><Icons.ChevronRight size={16}/></button>
          {viewMode !== 'week' && viewDateKey !== fmtDate(today) && <button className="ml-auto text-primary" onClick={() => setFocusDate(null)}>今天</button>}
          <button className="ml-auto text-primary" onClick={() => setShowDatePicker(true)}>{viewMode === 'week' ? '周视图' : viewMode === 'quick' ? '小事' : '日视图'}</button>
        </div>
      </header>
      <div className="agenda-scroll flex-1 overflow-y-auto">
        {viewMode === 'today' && <>
          <TodayAgenda agenda={agenda} categories={categories} compact={compact} onCheckIn={handleCheckIn} onSkip={viewDateKey >= fmtDate(today) ? handleSkip : undefined} onEdit={id => {setEditingTaskId(id);setShowForm(true)}} onAdd={openAdd}/>
          <div className="agenda-timeline">
            <button className="text-sm text-gray-500 py-3" aria-expanded={showTimeline} onClick={() => toggleTimeline(!showTimeline)}>{showTimeline ? '收起时间线' : '查看时间线'}</button>
            {showTimeline && <TodayTimeline records={records} entries={timelineEntries} categories={categories} dateKey={timelineDate} title="时间线" onAddNote={openAddNote} onDeleteEntry={deleteTimelineEntry} onEditEntry={openEditNote} onPrevDay={timelinePrevDay} onNextDay={timelineNextDay} onPickDate={timelinePickDate}/>}
          </div>
        </>}

        {viewMode === 'week' && (
          <WeekView
            weekDates={weekDates}
            today={today}
            isCurrentWeek={isCurrentWeek}
            grouped={weekGrouped}
            categories={categories}
            onCheckIn={handleCheckIn}
            onSkip={handleSkip}
            onEdit={(id) => {
              setEditingTaskId(id)
              setShowForm(true)
            }}
            onPickDate={handlePickDate}
          />
        )}

        {viewMode === 'quick' && (
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-3">
              <TextInput
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
                    done={records.some((r) => r.taskId === t.id)}
                    onToggle={(done) => handleCheckIn(t.id, done, records.find(r => r.taskId === t.id)?.date || fmtDate(new Date()))}
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

        <div className="agenda-version pt-4 pb-2 text-center text-[10px] text-gray-300">期待 v {APP_VERSION}</div>
      </div>

      {onOpenAgent && !compact && <div className="agenda-voice"><button onClick={onOpenAgent}><Icons.Mic size={17}/>对助手说</button></div>}

      <Modal open={showDatePicker} onClose={() => setShowDatePicker(false)} title="日期与视图">
        <div className="space-y-4">
          <div className="flex gap-2">{viewTabs.map(tab => <button key={tab.key} className={`flex-1 py-3 rounded-xl ${viewMode === tab.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => {setViewMode(tab.key);setShowDatePicker(false)}}>{tab.label}</button>)}</div>
          <input aria-label="查看日期" type="date" className="w-full p-3 border rounded-xl text-base" value={viewDateKey} onChange={event => {changeDate(event.target.value);setShowDatePicker(false)}}/>
          <div className="flex gap-2">
            <button className="flex-1 py-3 bg-gray-100 rounded-xl" onClick={() => {shiftViewDate(viewMode === 'week' ? -7 : -1);setShowDatePicker(false)}}>{viewMode === 'week' ? '上一周' : '上一天'}</button>
            <button className="flex-1 py-3 bg-gray-100 rounded-xl" onClick={() => {shiftViewDate(viewMode === 'week' ? 7 : 1);setShowDatePicker(false)}}>{viewMode === 'week' ? '下一周' : '下一天'}</button>
          </div>
          <button className="w-full text-primary py-3" onClick={() => {setFocusDate(null);setViewMode('today');setShowDatePicker(false)}}>回到今天</button>
        </div>
      </Modal>

      <TaskFormModal
        open={showForm}
        taskId={editingTaskId}
        defaultScheduledDate={defaultScheduledDate}
        onArchive={viewMode === 'week' ? id => {
          archiveTask(id)
          setShowForm(false)
          setEditingTaskId(null)
          showToast('已归档')
        } : undefined}
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
        occurrenceDate={pendingCheckIn?.dateKey || fmtDate(today)}
        defaultDate={pendingCheckIn?.startDate || fmtDate(today)}
        canRename={tasks.some(task => task.id === pendingCheckIn?.taskId && task.recurrence !== 'none')}
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

function WeekView({
  weekDates, today, isCurrentWeek, grouped, categories, onCheckIn, onSkip, onEdit, onPickDate,
}: {
  weekDates: Date[]
  today: Date
  isCurrentWeek: boolean
  grouped: Record<string, Array<{ task: Task; record?: CheckInRecord }>>
  categories: Category[]
  onCheckIn: (id: string, done: boolean, dateKey: string) => void
  onSkip: (id: string, dateKey: string) => void
  onEdit: (id: string) => void
  onPickDate: (dateKey: string) => void
}) {
  const todayKey = fmtDate(today)
  const allItems = Object.values(grouped).flat()
  const doneCount = allItems.filter(item => item.record).length

  return (
    <div className="agenda-week">
      <div className="agenda-week-summary">
        <strong>{isCurrentWeek ? '本周' : '所选周'}完成 {doneCount} / {allItems.length}</strong>
        <progress aria-label="本周进度" value={doneCount} max={allItems.length || 1}/>
      </div>
      {weekDates.map(day => {
        const key = fmtDate(day)
        const items = grouped[key]
        const done = items.filter(item => item.record).length
        return <section key={key} className="agenda-week-day" aria-labelledby={`week-${key}`}>
          <div className="agenda-week-day-header">
            <h2 id={`week-${key}`} className={key === todayKey ? 'is-today' : undefined}>
              <button type="button" onClick={() => onPickDate(key)} aria-label={`查看 ${dt.format(day,'MM月dd日')} 的任务`}>
                {dt.format(day,'EEEE')} · {day.getMonth()+1}月{day.getDate()}日
              </button>
            </h2>
            <span>{done}/{items.length} 已完成</span>
          </div>
          <div className="agenda-week-items">
            {items.length === 0 && <p>当天没有事项</p>}
            {items.map(({task,record}) => {
              const title = record?.taskTitle || task.title
              const color = categories.find(category => category.id === task.categoryId)?.color
              return <div key={task.id} className="agenda-week-item" data-task-id={task.id} data-occurrence={key}>
                <button type="button" className="agenda-week-task" onClick={() => onEdit(task.id)} aria-label={`编辑任务：${title}`}>
                  <span className="agenda-week-time">{task.scheduledTime || (task.calendarAllDay ? '全天' : '待定')}</span>
                  <span className="agenda-week-dot" style={{backgroundColor:color}} aria-hidden="true"/>
                  <span className="agenda-task-title">{title}</span>
                </button>
                {!record && key >= todayKey && task.recurrence !== 'none' && taskOccursOnDate(task,day) &&
                  <button type="button" className="agenda-skip" aria-label={`跳过本次：${title}`} onClick={() => onSkip(task.id,key)}>跳过</button>}
                <button type="button" className={`agenda-check ${record ? 'checked' : ''}`} aria-label={`${record ? '取消完成' : '标记完成'}：${title}`} onClick={() => onCheckIn(task.id,!!record,key)}>
                  {record && <Icons.Check size={15}/>}
                </button>
              </div>
            })}
          </div>
        </section>
      })}
    </div>
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
