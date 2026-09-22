import { useMemo, useState } from 'react'
import { fmtDate, getLunarDay, dt } from '@/utils/date'
import type { Category, CheckInRecord, Task } from '@/types'
import { CategoryIcon } from '@/utils/iconLibrary'
import { taskOccursOnDate } from '@/utils/recurrence'
import { Modal } from '@/components/common/Modal'
import { secondsToCompact } from '@/utils/date'

type Range = 'week' | 'month'

interface Props {
  records: CheckInRecord[]
  categories: Category[]
  tasks: Task[]
  filterCategoryId?: string  // 选中分类时仅展示该分类的色块与完成度
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEKDAYS_SHORT = ['一', '二', '三', '四', '五', '六', '日']

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

export function CategoryHeatmap({ records, categories, tasks, filterCategoryId }: Props) {
  const cats = filterCategoryId ? categories.filter((c) => c.id === filterCategoryId) : categories
  const [range, setRange] = useState<Range>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [detailDay, setDetailDay] = useState<string | null>(null)

  // ===== 周模式 =====
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor])
  const weekDates = useMemo(() => {
    const arr: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [weekStart])
  const dateKeys = useMemo(() => weekDates.map(fmtDate), [weekDates])

  const weekMatrix = useMemo(() => {
    return cats.map((cat) => {
      const tasksForCat = new Set(
        records.filter((r) => r.categoryId === cat.id).map((r) => r.taskId)
      )
      const cells = dateKeys.map((dk) => {
        const recs = records.filter((r) => r.categoryId === cat.id && r.date === dk)
        return {
          completed: new Set(recs.map((r) => r.taskId)).size,
          total: tasksForCat.size || 1,
          filled: recs.length > 0,
        }
      })
      return { category: cat, cells }
    })
  }, [cats, records, dateKeys, filterCategoryId])

  // ===== 月模式 =====
  const y = cursor.getFullYear()
  const m = cursor.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const firstDay = new Date(y, m, 1).getDay() // 0=周日
  const startPad = firstDay === 0 ? 6 : firstDay - 1

  const dayCategoryMap = useMemo(() => {
    const map: Record<number, Set<string>> = {}
    for (const r of records) {
      if (filterCategoryId && r.categoryId !== filterCategoryId) continue
      const d = new Date(r.date)
      if (d.getFullYear() === y && d.getMonth() === m) {
        const day = d.getDate()
        if (!map[day]) map[day] = new Set()
        map[day].add(r.categoryId)
      }
    }
    return map
  }, [records, y, m, filterCategoryId])

  const dayCountMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const r of records) {
      if (filterCategoryId && r.categoryId !== filterCategoryId) continue
      const d = new Date(r.date)
      if (d.getFullYear() === y && d.getMonth() === m) {
        map[d.getDate()] = (map[d.getDate()] || 0) + 1
      }
    }
    return map
  }, [records, y, m, filterCategoryId])

  // 当月每天涉及的事项数（用于月视图点开详情）
  const dayTaskMap = useMemo(() => {
    const map: Record<number, CheckInRecord[]> = {}
    for (const r of records) {
      if (filterCategoryId && r.categoryId !== filterCategoryId) continue
      const d = new Date(r.date)
      if (d.getFullYear() === y && d.getMonth() === m) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(r)
      }
    }
    return map
  }, [records, y, m, filterCategoryId])

  const today = new Date()
  const isThisMonth = today.getFullYear() === y && today.getMonth() === m

  const navPrev = () => {
    if (range === 'week') {
      const d = new Date(cursor)
      d.setDate(d.getDate() - 7)
      setCursor(d)
    } else {
      setCursor(new Date(y, m - 1, 1))
    }
  }
  const navNext = () => {
    if (range === 'week') {
      const d = new Date(cursor)
      d.setDate(d.getDate() + 7)
      setCursor(d)
    } else {
      setCursor(new Date(y, m + 1, 1))
    }
  }

  const rangeLabel =
    range === 'week'
      ? `${fmtDate(weekDates[0])} ~ ${fmtDate(weekDates[6])}`
      : `${y} 年 ${m + 1} 月`

  // ===== 可展开分类列表：每个分类下事项在查看周期内的完成情况 =====
  const periodDates = useMemo(() => {
    if (range === 'week') return weekDates
    const arr: Date[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(new Date(y, m, d))
    }
    return arr
  }, [range, weekDates, y, m, daysInMonth])

  // 每个分类 -> 相关事项及其应完成/已完成
  const categoryCompletion = useMemo(() => {
    const activeTasks = tasks.filter((t) => !t.archivedAt && !t.isQuick)
    const result: Record<
      string,
      { task: Task; expected: number; completed: number }[]
    > = {}
    for (const cat of cats) {
      const list = activeTasks
        .filter((t) => t.categoryId === cat.id)
        .map((task) => {
          const expected = periodDates.filter((d) => taskOccursOnDate(task, d)).length
          const completed = periodDates.filter((d) =>
            records.some((r) => r.taskId === task.id && r.date === fmtDate(d))
          ).length
          return { task, expected, completed }
        })
        .filter((x) => x.expected > 0 || x.completed > 0)
      if (list.length > 0) result[cat.id] = list
    }
    return result
  }, [tasks, cats, periodDates, records, filterCategoryId])

  // 每个分类整体完成率（供折叠态概览）
  const categorySummary = useMemo(() => {
    const map: Record<string, { expected: number; completed: number }> = {}
    for (const [catId, list] of Object.entries(categoryCompletion)) {
      map[catId] = list.reduce(
        (acc, x) => ({ expected: acc.expected + x.expected, completed: acc.completed + x.completed }),
        { expected: 0, completed: 0 }
      )
    }
    return map
  }, [categoryCompletion])

  const toggleCat = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const detailRecords = detailDay ? dayTaskMap[parseInt(detailDay.slice(8, 10), 10)] || [] : []

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-3 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">分类追踪</h3>
          <div className="flex items-center gap-1">
            <div className="flex bg-gray-100 rounded-full p-0.5 mr-1">
              <button
                onClick={() => setRange('week')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  range === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                周
              </button>
              <button
                onClick={() => setRange('month')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  range === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                月
              </button>
            </div>
            <button onClick={navPrev} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600">‹</button>
            <span className="text-xs text-gray-500 font-mono whitespace-nowrap">{rangeLabel}</span>
            <button onClick={navNext} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600">›</button>
          </div>
        </div>

        {range === 'week' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 text-gray-500 font-normal">分类</th>
                  {WEEKDAYS.map((w, i) => {
                    const d = weekDates[i]
                    const isToday = fmtDate(new Date()) === fmtDate(d)
                    return (
                      <th key={w} className="text-center py-1 font-normal">
                        <div className="text-gray-400 text-[10px]">{w}</div>
                        <div className={`mt-0.5 ${isToday ? 'text-primary font-bold' : 'text-gray-700'}`}>
                          {d.getDate()}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {weekMatrix.map(({ category, cells }) => (
                  <tr key={category.id} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-700 whitespace-nowrap">
                      <span className="mr-1 inline-flex align-middle"><CategoryIcon category={category} size={14} /></span>
                      {category.name}
                    </td>
                    {cells.map((cell, i) => (
                      <td key={i} className="text-center p-1">
                        <div
                          className="w-6 h-6 rounded-md mx-auto transition-transform active:scale-90"
                          style={{
                            background: cell.filled ? category.color : '#F2F2F7',
                            opacity: cell.filled ? 1 : 0.4,
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 text-center text-[10px] text-gray-400 mb-1">
              {WEEKDAYS_SHORT.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startPad }).map((_, i) => (
                <div key={`pad-${i}`} className="h-[78px] bg-gray-50/40 rounded-md" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const catIds = dayCategoryMap[day] || new Set<string>()
                const count = dayCountMap[day] || 0
                const isToday = isThisMonth && today.getDate() === day
                const hasRecords = count > 0
                return (
                  <button
                    key={day}
                    onClick={() => hasRecords && setDetailDay(`${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
                    disabled={!hasRecords}
                    className={`h-[78px] rounded-md border p-1 flex flex-col text-left transition ${
                      isToday ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'
                    } ${hasRecords ? 'active:scale-95 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span className={`font-semibold ${isToday ? 'text-primary' : 'text-gray-700'}`}>{day}</span>
                      <span className="text-[9px]">{getLunarDay(new Date(y, m, day))}</span>
                    </div>
                    <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                      {Array.from(catIds).slice(0, 3).map((cid) => {
                        const c = categories.find((x) => x.id === cid)
                        if (!c) return null
                        return (
                          <span
                            key={cid}
                            className="truncate rounded px-1 text-[9px] leading-tight"
                            style={{ background: `${c.color}22`, color: c.color }}
                          >
                            {c.name}
                          </span>
                        )
                      })}
                      {catIds.size > 3 && (
                        <span className="text-[9px] text-gray-400">+{catIds.size - 3}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400 text-center">有打卡的日期格子可点击查看当天分类详情</p>
          </div>
        )}
      </div>

      {/* 可展开分类列表：确认每个分类中事项的完成情况 */}
      <div className="bg-white rounded-2xl p-3 shadow-card">
        <h3 className="text-sm font-semibold mb-2">分类事项完成度</h3>
        <p className="text-[10px] text-gray-400 mb-2">
          {range === 'week' ? '本周' : `${y}年${m + 1}月`} 各分类事项的应完成 / 已完成
        </p>
        <div className="divide-y divide-gray-50">
          {cats
            .filter((c) => categoryCompletion[c.id]?.length)
            .map((cat) => {
              const sum = categorySummary[cat.id]
              const pct = sum.expected > 0 ? Math.round((sum.completed / sum.expected) * 100) : 0
              // 选中单一分类时强制展开其任务明细（而非仅汇总一行）
              const isOpen = !!filterCategoryId || expanded.has(cat.id)
              return (
                <div key={cat.id}>
                  <button
                    onClick={() => toggleCat(cat.id)}
                    className="w-full flex items-center gap-2 py-2.5 text-left active:scale-[0.99]"
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${cat.color}18`, color: cat.color }}
                    >
                      <CategoryIcon category={cat} size={15} />
                    </span>
                    <span className="text-sm font-medium text-gray-800 flex-1">{cat.name}</span>
                    <span className="text-[11px] text-gray-400 tabular-nums">
                      {sum.completed}/{sum.expected}
                    </span>
                    <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: cat.color }}
                      />
                    </div>
                    <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                      <IconsChevron />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-2 pl-9 space-y-1">
                      {categoryCompletion[cat.id].map(({ task, expected, completed }) => {
                        const done = expected > 0 && completed >= expected
                        const ratio = expected > 0 ? Math.round((completed / expected) * 100) : 0
                        return (
                          <div key={task.id} className="flex items-center gap-2 py-1">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] ${
                                done ? 'text-white' : 'text-gray-400 bg-gray-100'
                              }`}
                              style={done ? { background: cat.color } : undefined}
                            >
                              {done ? '✓' : ''}
                            </span>
                            <span className="text-[13px] text-gray-700 flex-1 truncate">
                              {task.title}
                            </span>
                            <span className="text-[10px] text-gray-400 tabular-nums">
                              {completed}/{expected}
                            </span>
                            <span
                              className="w-10 text-right text-[10px] tabular-nums"
                              style={{ color: cat.color }}
                            >
                              {ratio}%
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          {cats.filter((c) => categoryCompletion[c.id]?.length).length === 0 && (
            <div className="text-center py-6 text-sm text-gray-400">本周期还没有可追踪的事项</div>
          )}
        </div>
      </div>

      {/* 月视图点击：当天分类详情 */}
      <Modal
        open={!!detailDay}
        onClose={() => setDetailDay(null)}
        title={detailDay ? `${detailDay} 当天打卡` : '当天打卡'}
      >
        {detailRecords.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">这一天还没有打卡记录</div>
        ) : (
          <div>
            <div className="text-xs text-gray-500 mb-2">共 {detailRecords.length} 次打卡</div>
            <div className="divide-y divide-gray-50">
              {detailRecords
                .slice()
                .sort((a, b) => b.completedAt - a.completedAt)
                .map((r) => {
                  const cat = categories.find((c) => c.id === r.categoryId)
                  const time = r.startedAt
                    ? dt.format(new Date(r.startedAt), 'HH:mm')
                    : dt.format(new Date(r.completedAt), 'HH:mm')
                  return (
                    <div key={r.id} className="py-2.5 flex items-center gap-2.5">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: cat ? `${cat.color}18` : '#F2F2F7', color: cat?.color }}
                      >
                        <CategoryIcon category={cat || { emoji: '📌' }} size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {r.taskTitle}
                        </div>
                        <div className="text-xs text-gray-500">
                          {time}
                          {r.durationSeconds > 0 && ` · ${secondsToCompact(r.durationSeconds)}`}
                          {cat && ` · ${cat.name}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function IconsChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
