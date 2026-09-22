interface Props {
  data: { date: string; count: number }[]
}

export function StatsLineChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const width = 320
  const height = 140
  const padding = { l: 24, r: 12, t: 12, b: 24 }
  const w = width - padding.l - padding.r
  const h = height - padding.t - padding.b

  if (data.length === 0) return null

  const stepX = w / Math.max(1, data.length - 1)

  // 折线点
  const points = data.map((d, i) => {
    const x = padding.l + i * stepX
    const y = padding.t + h - (d.count / max) * h
    return { x, y, ...d }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const fillD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${padding.t + h} L ${points[0].x.toFixed(1)} ${padding.t + h} Z`

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <line
            key={i}
            x1={padding.l}
            y1={padding.t + h * p}
            x2={padding.l + w}
            y2={padding.t + h * p}
            stroke="#F2F2F7"
            strokeWidth="1"
          />
        ))}

        {/* 填充区域 */}
        <path d={fillD} fill="url(#lineGrad)" />

        {/* 折线 */}
        <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* 圆点 */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#3B82F6" />
          </g>
        ))}

        {/* Y 轴标签 */}
        <text x={padding.l - 4} y={padding.t + 4} fontSize="9" fill="#8E8E93" textAnchor="end">{max}</text>
        <text x={padding.l - 4} y={padding.t + h + 2} fontSize="9" fill="#8E8E93" textAnchor="end">0</text>

        {/* X 轴标签（月初/月中/月末） */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => {
          const p = points[i]
          return (
            <text
              key={i}
              x={p.x}
              y={height - 6}
              fontSize="9"
              fill="#8E8E93"
              textAnchor="middle"
            >
              {data[i].date.slice(8)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}