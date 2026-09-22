import { useState } from 'react'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { fmtDate, dt } from '@/utils/date'
import { TodayTimeline } from '@/components/timeline/TodayTimeline'
import { TimelineNoteModal } from '@/components/timeline/TimelineNoteModal'
import { WeeklyReview } from './WeeklyReview'
import { MonthlyReview } from './MonthlyReview'
import { AnnualReview } from './AnnualReview'
import { TrendsScreen } from './TrendsScreen'
import type { TimelineEntry } from '@/types'
import { showToast } from '@/components/common/Toast'

type Seg = 'timeline' | 'week' | 'month' | 'year' | 'trends'

// 时间线 / 回顾 聚合页：底部导航的「回顾」Tab 入口。
// 以分段控件切换 时间线（日历记事本）/ 周复盘 / 月复盘 / 年复盘 / 趋势，
// 复用现有各复盘屏，按激活态懒渲染（避免同时挂载多个 recharts 实例）。
export function TimelineReviewScreen() {
  const {
    records,
    timelineEntries,
    categories,
    addTimelineNote,
    updateTimelineEntry,
    deleteTimelineEntry,
  } = useStore()
  const [seg, setSeg] = useState<Seg>('timeline')
  const [timelineDate, setTimelineDate] = useState<string>(fmtDate(new Date()))
  const [noteModal, setNoteModal] = useState<{ date: string; startTime: string; entry?: TimelineEntry } | null>(null)

  const prevDay = () =>
    setTimelineDate(fmtDate(dt.addDays(new Date(timelineDate + 'T00:00:00'), -1)))
  const nextDay = () =>
    setTimelineDate(fmtDate(dt.addDays(new Date(timelineDate + 'T00:00:00'), 1)))
  const openAddNote = () => {
    const isToday = timelineDate === fmtDate(new Date())
    const now = `${String(new Date().getHours()).padStart(2, '0')}:${String(
      new Date().getMinutes()
    ).padStart(2, '0')}`
    setNoteModal({ date: timelineDate, startTime: isToday ? now : '09:00' })
  }
  const openEditNote = (entry: TimelineEntry) =>
    setNoteModal({ date: entry.date, startTime: entry.startTime, entry })

  const segs: { key: Seg; label: string }[] = [
    { key: 'timeline', label: '时间线' },
    { key: 'week', label: '周' },
    { key: 'month', label: '月' },
    { key: 'year', label: '年' },
    { key: 'trends', label: '趋势' },
  ]

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">回顾</h1>
        <div className="flex bg-gray-100 rounded-full p-0.5">
          {segs.map((s) => (
            <button
              key={s.key}
              onClick={() => setSeg(s.key)}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium transition ${
                seg === s.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {seg === 'timeline' && (
          <div className="h-full overflow-y-auto px-3 pb-24">
            <TodayTimeline
              records={records}
              entries={timelineEntries}
              categories={categories}
              dateKey={timelineDate}
              title="时间线"
              onAddNote={openAddNote}
              onDeleteEntry={(id) => {
                deleteTimelineEntry(id)
                showToast('已删除')
              }}
              onEditEntry={openEditNote}
              onPrevDay={prevDay}
              onNextDay={nextDay}
              onPickDate={(k) => setTimelineDate(k)}
            />
          </div>
        )}
        {seg === 'week' && <WeeklyReview />}
        {seg === 'month' && (
          <MonthlyReview records={records} categories={categories} entries={timelineEntries} />
        )}
        {seg === 'year' && (
          <AnnualReview records={records} categories={categories} entries={timelineEntries} />
        )}
        {seg === 'trends' && <TrendsScreen />}
      </div>

      <TimelineNoteModal
        open={!!noteModal}
        editEntry={noteModal?.entry ?? null}
        defaultDate={noteModal?.date || fmtDate(new Date())}
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
    </div>
  )
}
