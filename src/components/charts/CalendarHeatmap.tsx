import { useMemo, useState } from 'react'
import { fmtDate } from '@/utils/date'

interface Props {
  year: number
  data: Record<string, number>  // 日期 -> 打卡次数
  color?: string                 // 选中分类颜色；提供时色块按该颜色着色
  label?: string                 // 副标题（如分类名 / 「全部」）
}

// 仿 GitHub contribution 图的热力图
export function CalendarHeatmap({ year, data, color, label }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; date: string; count: number } | null>(null)
  const baseColor = color || '#3B82F6'

  function hexToRgb(hex: string) {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `${r}, ${g}, ${b}`
  }

  // 计算每周日期（按周分列）
  const weeks = useMemo(() => {
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)
    const allDays: Date[] = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDays.push(new Date(d))
    }

    // 调整为周一开始
    const firstDay = start.getDay() // 0=周日
    const padBefore = firstDay === 0 ? 6 : firstDay - 1
    const padded: (Date | null)[] = [...Array(padBefore).fill(null), ...allDays]
    const result: (Date | null)[][] = []
    for (let i = 0; i < padded.length; i += 7) {
      result.push(padded.slice(i, i + 7))
    }
    return result
  }, [year])

  const max = Math.max(...Object.values(data), 1)
  const months = useMemo(() => {
    const result: { month: number; weekIndex: number }[] = []
    let lastMonth = -1
    weeks.forEach((week, i) => {
      week.forEach((d) => {
        if (d && d.getMonth() !== lastMonth && d.getDate() <= 7) {
          result.push({ month: d.getMonth(), weekIndex: i })
          lastMonth = d.getMonth()
        }
      })
    })
    return result
  }, [weeks])

  return (
    <div className="bg-white rounded-2xl p-3 shadow-card overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{year} 年{label ? ` · ${label}` : ''}</h3>
        <div className="text-[10px] text-gray-400">意念不忘，必有回响</div>
      </div>
      <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
        <div className="inline-block">
          {/* 月份标签 */}
          <div className="flex gap-1 mb-1 ml-5 relative" style={{ height: 12 }}>
            {months.map((m) => (
              <div
                key={`${m.month}-${m.weekIndex}`}
                className="text-[10px] text-gray-500 absolute"
                style={{ left: m.weekIndex * 12 }}
              >
                {['1','2','3','4','5','6','7','8','9','10','11','12'][m.month]}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {/* 周几标签 */}
            <div className="flex flex-col gap-1 mr-1">
              {['', '一', '', '三', '', '五', ''].map((d, i) => (
                <div key={i} className="text-[9px] text-gray-400 h-[10px] leading-[10px]">{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => {
                  if (!day) return <div key={di} className="w-[10px] h-[10px]" />
                  const dateStr = fmtDate(day)
                  const count = data[dateStr] || 0
                  const intensity = count / max
                  const isToday = fmtDate(new Date()) === dateStr
                  return (
                    <div
                      key={di}
                      onMouseEnter={(e) => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setHover({ x: rect.left, y: rect.top, date: dateStr, count })
                      }}
                      onMouseLeave={() => setHover(null)}
                      onTouchStart={(e) => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setHover({ x: rect.left, y: rect.top, date: dateStr, count })
                      }}
                      onTouchEnd={() => setTimeout(() => setHover(null), 1500)}
                      className={`w-[10px] h-[10px] rounded-sm cursor-pointer transition-transform hover:scale-150 ${
                        isToday ? 'ring-1 ring-primary' : ''
                      }`}
                      style={{
                        background:
                          count === 0
                            ? '#F2F2F7'
                            : `rgba(${hexToRgb(baseColor)}, ${0.25 + intensity * 0.7})`,
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-1.5 mt-3 justify-end text-[10px] text-gray-500">
        <span>少</span>
        {[0.15, 0.35, 0.55, 0.75, 0.95].map((v) => (
          <div
            key={v}
            className="w-2.5 h-2.5 rounded-sm"
            style={{ background: `rgba(${hexToRgb(baseColor)}, ${v})` }}
          />
        ))}
        <span>多</span>
      </div>

      {hover && (
        <div
          className="fixed z-50 px-2 py-1 bg-black/80 text-white text-xs rounded shadow-lg pointer-events-none"
          style={{ left: hover.x, top: hover.y - 32 }}
        >
          {hover.date} · {hover.count} 次
        </div>
      )}
    </div>
  )
}