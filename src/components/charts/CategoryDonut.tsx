import type { Category, CheckInRecord } from '@/types'

interface Props {
  records: CheckInRecord[]
  categories: Category[]
}

export function CategoryDonut({ records, categories }: Props) {
  // 统计每个分类的打卡次数
  const counts = new Map<string, number>()
  records.forEach((r) => {
    counts.set(r.categoryId, (counts.get(r.categoryId) || 0) + 1)
  })

  const total = records.length
  const items = categories
    .map((c) => ({ category: c, count: counts.get(c.id) || 0 }))
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        暂无打卡数据
      </div>
    )
  }

  const size = 160
  const stroke = 18
  const radius = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius

  let offset = 0
  const segments = items.map(({ category, count }) => {
    const fraction = count / total
    const len = fraction * circumference
    const seg = {
      category,
      count,
      fraction,
      dash: `${len} ${circumference - len}`,
      rotation: (offset / circumference) * 360,
    }
    offset += len
    return seg
  })

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#F2F2F7" strokeWidth={stroke} />
          {segments.map((s) => (
            <circle
              key={s.category.id}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={s.category.color}
              strokeWidth={stroke}
              strokeDasharray={s.dash}
              strokeLinecap="butt"
              transform={`rotate(${s.rotation - 90} ${cx} ${cy})`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-400">总打卡</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {items.map(({ category, count }) => (
          <div key={category.id} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: category.color }}
            />
            <span className="truncate text-gray-700">{category.name}</span>
            <span className="ml-auto font-medium text-gray-900 tabular-nums">{count}</span>
            <span className="text-gray-400 tabular-nums w-9 text-right">
              {Math.round((count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
