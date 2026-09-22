interface ProgressBarProps {
  value: number
  total: number
  color?: string
  height?: number
  showLabel?: boolean
}

export function ProgressBar({ value, total, color = '#3B82F6', height = 8, showLabel = true }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0
  return (
    <div className="w-full">
      <div
        className="w-full rounded-full overflow-hidden bg-gray-100"
        style={{ height }}
      >
        <div
          className="progress-bar-fill h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-[11px] text-gray-500">
          <span>{value}</span>
          <span>{total}</span>
        </div>
      )}
    </div>
  )
}