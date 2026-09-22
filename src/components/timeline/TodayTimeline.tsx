import type { CheckInRecord, Category, TimelineEntry } from '@/types'
import { dt, secondsToCompact } from '@/utils/date'
import { Icons } from '@/components/common/Icons'

interface Props {
  records: CheckInRecord[]
  entries: TimelineEntry[]
  categories: Category[]
  dateKey: string
  title?: string
  onAddNote: (defaultTime: string) => void
  onDeleteEntry: (id: string) => void
  onEditEntry: (entry: TimelineEntry) => void
  onPrevDay: () => void
  onNextDay: () => void
  onPickDate: (date: string) => void
}

type Item =
  | {
      type: 'checkin'
      id: string
      time: string
      color: string
      catName?: string
      catIcon?: string
      title: string
      dur: number
      isMakeup?: boolean
    }
  | {
      type: 'note'
      id: string
      startTime: string
      endTime?: string
      color: string
      catName?: string
      content: string
    }

// 计算起止时间差（分钟），支持跨天，同分钟返回 0
function diffMinutes(start?: string, end?: string): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null
  let diff = eh * 60 + em - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60
  return diff
}

// 当日时间线（日历记事本）：合并「打卡记录」与「手动记事」，按时间排序展示
// 顶部带跨天浏览（前一天 / 后一天 / 点日期选日历）
export function TodayTimeline({
  records,
  entries,
  categories,
  dateKey,
  title,
  onAddNote,
  onDeleteEntry,
  onEditEntry,
  onPrevDay,
  onNextDay,
  onPickDate,
}: Props) {
  const dayRecords = records.filter((r) => r.date === dateKey)
  const dayEntries = entries.filter((e) => e.date === dateKey)

  const catOf = (id?: string) => categories.find((c) => c.id === id)

  const items: Item[] = [
    ...dayRecords.map<Item>((r) => {
      const cat = catOf(r.categoryId)
      const startT = r.startedAt
        ? dt.format(new Date(r.startedAt), 'HH:mm')
        : dt.format(new Date(r.completedAt), 'HH:mm')
      return {
        type: 'checkin',
        id: r.id,
        time: startT,
        color: cat?.color || '#34C759',
        catName: cat?.name,
        title: r.taskTitle,
        dur: r.durationSeconds || 0,
        isMakeup: r.isMakeup,
      }
    }),
    ...dayEntries.map<Item>((e) => {
      const cat = catOf(e.categoryId)
      return {
        type: 'note',
        id: e.id,
        startTime: e.startTime,
        endTime: e.endTime,
        color: cat?.color || '#8E8E93',
        catName: cat?.name,
        content: e.content,
      }
    }),
  ].sort((a, b) => {
    const ta = a.type === 'checkin' ? a.time : a.startTime
    const tb = b.type === 'checkin' ? b.time : b.startTime
    return ta.localeCompare(tb)
  })

  const totalSeconds = dayRecords.reduce((s, r) => s + (r.durationSeconds || 0), 0)

  const now = new Date()
  const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // 顶部日期导航
  const nav = (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-1">
        <button onClick={onPrevDay} className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center active:scale-95" aria-label="前一天">
          ‹
        </button>
        <label className="relative cursor-pointer px-2 py-1 rounded-lg active:scale-95">
          <span className="text-sm font-semibold text-gray-800">
            {dt.format(new Date(dateKey + 'T00:00:00'), 'MM/dd')} {dt.format(new Date(dateKey + 'T00:00:00'), 'EEEE')}
          </span>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => e.target.value && onPickDate(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            aria-label="选择日期"
          />
        </label>
        <button onClick={onNextDay} className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center active:scale-95" aria-label="后一天">
          ›
        </button>
      </div>
      <button
        onClick={() => onAddNote(nowHHmm)}
        className="text-[12px] text-primary font-medium active:scale-95 shrink-0"
      >
        + 记一笔
      </button>
    </div>
  )

  if (items.length === 0) {
    return (
      <div className="mt-4 bg-white rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">{title || '时间线'}</h3>
        </div>
        {nav}
        <div className="text-center text-gray-400 text-sm py-3">
          这一天还没有记录，点「记一笔」写点什么
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-800">{title || '时间线'}</h3>
        {totalSeconds > 0 && (
          <span className="text-[11px] text-gray-400">累计 {secondsToCompact(totalSeconds)}</span>
        )}
      </div>
      {nav}

      <div className="bg-white rounded-2xl shadow-card px-4 py-3">
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-gray-100 rounded-full" />
          <div className="space-y-3.5">
            {items.map((it) => (
              <div key={`${it.type}-${it.id}`} className="relative flex gap-3">
                <div className="relative z-10 shrink-0 w-3 flex justify-center pt-1.5">
                  <div
                    className={`w-3 h-3 rounded-full ring-2 ring-white ${it.type === 'note' ? 'border border-dashed' : ''}`}
                    style={{
                      background: it.type === 'note' ? '#fff' : it.color,
                      borderColor: it.color,
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0 pb-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-gray-700">
                      {it.type === 'note'
                        ? `${it.startTime}${it.endTime ? ` – ${it.endTime}` : ''}`
                        : it.time}
                    </span>
                    <div className="flex items-center gap-2">
                      {it.type === 'checkin' && (it as any).dur > 0 && (
                        <span className="text-[11px] text-gray-400">{secondsToCompact((it as any).dur)}</span>
                      )}
                      {it.type === 'note' && (() => {
                        const m = diffMinutes(it.startTime, it.endTime)
                        return m != null && m > 0 ? (
                          <span className="text-[11px] text-gray-400">
                            {m >= 60 ? `${Math.floor(m / 60)}h${m % 60}m` : `${m}m`}
                          </span>
                        ) : null
                      })()}
                      {it.type === 'note' && (
                        <button
                          onClick={() => onEditEntry(dayEntries.find((e) => e.id === it.id)!)}
                          className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center active:scale-95 shrink-0"
                          aria-label="编辑记事"
                        >
                          <Icons.Edit size={12} />
                        </button>
                      )}
                      {it.type === 'note' && (
                        <button
                          onClick={() => onDeleteEntry(it.id)}
                          className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center active:scale-95 shrink-0"
                          aria-label="删除记事"
                        >
                          <Icons.Trash size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {it.catName && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] shrink-0"
                        style={{ color: it.color }}
                      >
                        {it.catName}
                      </span>
                    )}
                    {it.type === 'checkin' ? (
                      <span className="text-[13px] text-gray-800 truncate">{(it as any).title}</span>
                    ) : (
                      <span className="text-[13px] text-gray-800 whitespace-pre-wrap break-words leading-snug">
                        {(it as any).content}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
