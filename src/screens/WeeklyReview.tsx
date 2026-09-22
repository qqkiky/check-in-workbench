import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { dt, fmtDate, getLunarDay } from '@/utils/date'
import { secondsToCompact } from '@/utils/date'
import { buildDayTimeline } from '@/utils/timeline'

type WindowMode = 1 | 3 | 7

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function WeeklyReview() {
  const { records, timelineEntries, categories } = useStore()
  const [mode, setMode] = useState<WindowMode>(7)
  // 窗口起始日（默认今天）
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const days = useMemo(() => {
    const arr: Date[] = []
    for (let i = 0; i < mode; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [startDate, mode])

  const shiftWindow = (delta: number) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + delta * mode)
    setStartDate(d)
  }

  // 卡片宽度：7天/3天模式一行显示约3张（可滑动）；1天模式单张大卡
  const cardWidthPct = mode === 1 ? 92 : mode === 3 ? 31 : 31

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900">每周复盘</h1>
          <Icons.Calendar size={18} className="text-gray-500" />
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* 窗宽切换 */}
          <div className="flex bg-white rounded-full p-0.5 shadow-card">
            {([1, 3, 7] as WindowMode[]).map((w) => (
              <button
                key={w}
                onClick={() => setMode(w)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ${
                  mode === w ? 'bg-primary text-white' : 'text-gray-500'
                }`}
              >
                {w}天
              </button>
            ))}
          </div>

          {/* 窗口翻页 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftWindow(-1)}
              className="w-8 h-8 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95"
              aria-label="上一窗口"
            >
              <Icons.ChevronLeft size={16} />
            </button>
            <span className="text-[11px] text-gray-500 font-mono whitespace-nowrap px-1">
              {fmtDate(days[0])}
              {mode > 1 && ` ~ ${fmtDate(days[days.length - 1])}`}
            </span>
            <button
              onClick={() => shiftWindow(1)}
              className="w-8 h-8 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95"
              aria-label="下一窗口"
            >
              <Icons.ChevronRight size={16} />
            </button>
          </div>
        </div>

        {mode === 7 && (
          <p className="mt-2 text-[10px] text-gray-400 text-center">左右滑动浏览本周各天的时间线</p>
        )}
      </header>

      {/* 横向滑动的每日时间线卡片流 */}
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar px-4 py-3"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex gap-2 h-full">
          {days.map((d) => {
            const dateKey = fmtDate(d)
            const items = buildDayTimeline(dateKey, records, timelineEntries, categories)
            const totalDur = items.reduce((s, it) => s + it.dur, 0)
            const dow = WEEKDAYS[d.getDay()]
            const isToday = fmtDate(new Date()) === dateKey
            return (
              <div
                key={dateKey}
                className="snap-start shrink-0 h-full flex flex-col bg-white rounded-2xl p-3 shadow-card"
                style={{ width: `${cardWidthPct}%` }}
              >
                {/* 卡片头 */}
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-50">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className={`text-base font-bold ${isToday ? 'text-primary' : 'text-gray-900'}`}>
                      {d.getMonth() + 1}/{d.getDate()}
                    </span>
                    <span className="text-[11px] text-gray-400">{dow}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{getLunarDay(d)}</span>
                </div>

                {/* 当天的项 */}
                {items.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-300 py-8">
                    <Icons.Calendar size={26} />
                    <span className="text-[11px] mt-2">无记录</span>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto -mr-1 pr-1 space-y-2">
                    {items.map((it) => (
                      <div key={it.id} className="flex gap-2">
                        {/* 时间轴圆点 */}
                        <div className="flex flex-col items-center pt-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              background: it.type === 'note' ? 'transparent' : it.color,
                              border: it.type === 'note' ? `2px dashed ${it.color}` : 'none',
                            }}
                          />
                          {it !== items[items.length - 1] && (
                            <span className="w-px flex-1 bg-gray-100 mt-0.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-gray-500">
                              {it.time}
                              {it.endTime ? `–${it.endTime}` : ''}
                            </span>
                            {it.dur > 0 && (
                              <span className="text-[10px] text-gray-400">{secondsToCompact(it.dur)}</span>
                            )}
                          </div>
                          <div className="text-[13px] text-gray-800 truncate">
                            {it.type === 'checkin' ? it.title : it.content}
                          </div>
                          {it.catName && (
                            <span
                              className="inline-block mt-0.5 text-[9px] px-1 rounded"
                              style={{ background: `${it.color}22`, color: it.color }}
                            >
                              {it.catName}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 卡片底：当日汇总 */}
                <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-400">
                  <span>{items.length} 项</span>
                  <span>合计 {secondsToCompact(totalDur)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
