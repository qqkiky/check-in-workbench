import { useMemo, useState } from 'react'
import type { Category } from '@/types'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { Modal } from '@/components/common/Modal'
import { CategoryIcon } from '@/utils/iconLibrary'
import { dt, fmtDate, getLunarDay } from '@/utils/date'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { CategoryHeatmap } from '@/components/charts/CategoryHeatmap'
import { AnnualReview } from '@/screens/AnnualReview'
import { WeeklyReview } from '@/screens/WeeklyReview'
import { MonthlyReview } from '@/screens/MonthlyReview'

type TrendsTab = 'heatmap' | 'category' | 'weekly' | 'month' | 'year'

export function TrendsScreen() {
  const { records, categories, tasks, timelineEntries } = useStore()
  const today = new Date()
  const [year] = useState(today.getFullYear())
  const [tab, setTab] = useState<TrendsTab>('heatmap')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const yearlyStats = useMemo(() => {
    const map: Record<string, number> = {}
    records.forEach((r) => {
      const yearKey = r.date.slice(0, 4)
      if (yearKey === String(year)) {
        map[r.date] = (map[r.date] || 0) + 1
      }
    })
    return map
  }, [records, year])

  // 按分类筛选后的年度热力图数据（「全部」时沿用原始统计）
  const heatmapData = useMemo(() => {
    if (catFilter === 'all') return yearlyStats
    const map: Record<string, number> = {}
    records.forEach((r) => {
      if (r.categoryId === catFilter && r.date.slice(0, 4) === String(year)) {
        map[r.date] = (map[r.date] || 0) + 1
      }
    })
    return map
  }, [records, catFilter, year, yearlyStats])

  const totalCount = Object.values(yearlyStats).reduce((a, b) => a + b, 0)
  const todayCount = yearlyStats[fmtDate(today)] || 0

  const selectedRecords = useMemo(() => {
    if (!selectedDate) return []
    return records
      .filter((r) => r.date === selectedDate)
      .filter((r) => (catFilter === 'all' ? true : r.categoryId === catFilter))
      .sort((a, b) => b.completedAt - a.completedAt)
  }, [records, selectedDate, catFilter])

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900">趋势</h1>
          <Icons.BarChart size={18} className="text-gray-500" />
        </div>

        <div className="bg-white rounded-2xl p-3 grid grid-cols-3 gap-2 shadow-card">
          <Stat label="今年打卡" value={totalCount} suffix="次" />
          <Stat label="今日打卡" value={todayCount} suffix="次" />
          <Stat label="连续天数" value={streakDays(yearlyStats)} suffix="天" />
        </div>

        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k: 'heatmap', l: '日历热力' },
            { k: 'category', l: '分类追踪' },
            { k: 'weekly', l: '每周复盘' },
            { k: 'month', l: '月度复盘' },
            { k: 'year', l: '年度复盘' },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as TrendsTab)}
              className={`pill-tab whitespace-nowrap ${
                tab === t.k ? 'pill-tab-active' : 'pill-tab-inactive'
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'heatmap' && (
          <div className="px-3 py-3">
            <CategoryDropdown categories={categories} value={catFilter} onChange={setCatFilter} />
            <CalendarHeatmap
              year={year}
              data={heatmapData}
              color={catFilter === 'all' ? undefined : categories.find((c) => c.id === catFilter)?.color}
              label={catFilter === 'all' ? '全部' : categories.find((c) => c.id === catFilter)?.name}
            />
            <MonthlyStrip
              records={records}
              filterCategoryId={catFilter === 'all' ? undefined : catFilter}
              color={catFilter === 'all' ? undefined : categories.find((c) => c.id === catFilter)?.color}
              onSelect={setSelectedDate}
            />
          </div>
        )}

        {tab === 'category' && (
          <div className="px-3 py-3">
            <CategoryDropdown categories={categories} value={catFilter} onChange={setCatFilter} />
            <CategoryHeatmap
              records={records}
              categories={categories}
              tasks={tasks}
              filterCategoryId={catFilter === 'all' ? undefined : catFilter}
            />
          </div>
        )}

        {tab === 'weekly' && (
          <WeeklyReview />
        )}

        {tab === 'month' && (
          <MonthlyReview records={records} categories={categories} entries={timelineEntries} />
        )}

        {tab === 'year' && (
          <AnnualReview records={records} categories={categories} entries={timelineEntries} />
        )}
      </div>

      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={
          selectedDate
            ? `${selectedDate}${catFilter === 'all' ? ' 打卡详情' : ` · ${categories.find((c) => c.id === catFilter)?.name || ''} 任务明细`}`
            : '打卡详情'
        }
      >
        {selectedRecords.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">这一天还没有打卡记录</div>
        ) : (
          <div>
            <div className="text-xs text-gray-500 mb-2">共 {selectedRecords.length} 次打卡</div>
            <div className="divide-y divide-gray-50">
              {selectedRecords.map((r) => {
                const cat = categories.find((c) => c.id === r.categoryId)
                return (
                  <div key={r.id} className="py-2.5 flex items-center gap-2.5">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: cat ? `${cat.color}18` : '#F2F2F7', color: cat?.color }}
                    >
                      <CategoryIcon category={cat || { emoji: '📌' }} size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.taskTitle}</div>
                      <div className="text-xs text-gray-500">{dt.format(new Date(r.completedAt), 'HH:mm:ss')}</div>
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

function CategoryDropdown({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = value === 'all' ? null : categories.find((c) => c.id === value)
  const select = (v: string) => {
    onChange(v)
    setOpen(false)
  }
  return (
    <div className="relative mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-card active:scale-[0.99]"
      >
        <span className="text-[12px] text-gray-400 shrink-0">分类筛选</span>
        <span className="flex-1 flex items-center gap-1.5 text-[13px] font-medium text-gray-800 truncate">
          {current ? (
            <>
              <CategoryIcon category={current} size={15} color={current.color} />
              {current.name}
            </>
          ) : (
            '全部分类'
          )}
        </span>
        <Icons.ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 z-40 bg-white rounded-xl shadow-lg border border-gray-100 max-h-72 overflow-y-auto py-1">
            <button
              onClick={() => select('all')}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-[13px] ${
                value === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700'
              }`}
            >
              全部分类
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-[13px] ${
                  value === c.id ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700'
                }`}
              >
                <CategoryIcon category={c} size={15} color={c.color} />
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-gray-900">
        {value}
        <span className="text-xs font-normal text-gray-500 ml-0.5">{suffix}</span>
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function streakDays(data: Record<string, number>): number {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = fmtDate(d)
    if (data[key]) {
      streak++
    } else {
      if (i === 0) continue
      break
    }
  }
  return streak
}

function MonthlyStrip({
  records,
  filterCategoryId,
  color,
  onSelect,
}: {
  records: any[]
  filterCategoryId?: string
  color?: string
  onSelect: (dateStr: string) => void
}) {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const firstDay = new Date(y, m, 1).getDay()
  const startPad = firstDay === 0 ? 6 : firstDay - 1

  const dayMap: Record<number, number> = {}
  records.forEach((r) => {
    if (filterCategoryId && r.categoryId !== filterCategoryId) return
    const d = new Date(r.date)
    if (d.getFullYear() === y && d.getMonth() === m) {
      dayMap[d.getDate()] = (dayMap[d.getDate()] || 0) + 1
    }
  })

  const max = Math.max(...Object.values(dayMap), 1)
  const baseColor = color || '#3B82F6'
  const rgb = (() => {
    const h = baseColor.replace('#', '')
    return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`
  })()

  return (
    <div className="bg-white rounded-2xl p-3 mt-3 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">
          {y} 年 {m + 1} 月{filterCategoryId ? ' · 分类明细' : ''}
        </h3>
        <span className="text-xs text-gray-400">轻触色块查看</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 mb-1">
        {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const count = dayMap[day] || 0
          const isToday = today.getDate() === day
          const intensity = count / max
          return (
            <button
              key={day}
              onClick={() => count > 0 && onSelect(dateStr)}
              disabled={count === 0}
              className={`aspect-square rounded-md flex flex-col items-center justify-center text-[11px] active:scale-90 transition-transform ${
                isToday ? 'ring-1 ring-primary' : ''
              } ${count > 0 ? 'cursor-pointer' : 'cursor-default'}`}
              style={{
                background:
                  count === 0
                    ? '#F2F2F7'
                    : `rgba(${rgb}, ${0.25 + intensity * 0.7})`,
                color: count > 0 && intensity > 0.5 ? 'white' : '#1C1C1E',
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}