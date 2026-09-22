import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { showToast } from '@/components/common/Toast'
import { fmtDate } from '@/utils/date'

interface Props {
  open: boolean
  taskTitle: string
  defaultDate: string
  defaultStart: string
  defaultEnd: string
  onClose: () => void
  onConfirm: (start: string, end: string, date: string) => void
}

// 在 HH:mm 基础上加 n 分钟（用于补卡默认结束时间预填）
function shiftMinutes(hm: string, add: number): string {
  const [h, m] = hm.split(':').map(Number)
  const total = h * 60 + m + add
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// 打卡时选择「日期 + 开始时间 + 结束时间」，用于「今日时间线」计算任务时长。
// 补卡场景可在此选择实际完成日期，避免完成时间被锁死成计划时间。
export function CheckInTimeModal({
  open,
  taskTitle,
  defaultDate,
  defaultStart,
  defaultEnd,
  onClose,
  onConfirm,
}: Props) {
  const [date, setDate] = useState(defaultDate)
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)

  useEffect(() => {
    if (open) {
      setDate(defaultDate)
      setStart(defaultStart)
      setEnd(defaultEnd)
    }
  }, [open, defaultDate, defaultStart, defaultEnd])

  // 所选日期早于今天 → 视为补卡
  const isMakeup = date < fmtDate(new Date())
  // 日期晚于今天（手动选了未来）→ 给出提示但不阻止
  const isFuture = date > fmtDate(new Date())

  const startMin = (() => {
    const [h, m] = start.split(':').map(Number)
    return h * 60 + m
  })()
  const endMin = (() => {
    const [h, m] = end.split(':').map(Number)
    return h * 60 + m
  })()
  const crossDay = endMin - startMin < 0
  const durMin = crossDay ? endMin - startMin + 24 * 60 : endMin - startMin

  const handleConfirm = () => {
    if (!date) {
      showToast('请选择日期')
      return
    }
    onConfirm(start, end, date)
  }

  const fmtDur = (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h > 0 && m > 0) return `${h}小时${m}分`
    if (h > 0) return `${h}小时`
    return `${m}分钟`
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isMakeup ? '补卡' : '记录打卡时间'}
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full bg-gray-100 text-gray-600 font-medium active:scale-95"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-full bg-primary text-white font-medium active:scale-95"
          >
            {isMakeup ? '确认补卡' : '确认打卡'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-700 font-medium truncate">{taskTitle}</div>

        <label className="block">
          <span className="text-xs text-gray-500">完成日期</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ color: '#1C1C1E', WebkitTextFillColor: '#1C1C1E', caretColor: '#1C1C1E' }}
            className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 text-base outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {isMakeup && (
          <div className="text-[11px] text-orange-500">
            补卡模式：记录将记到所选日期（{date}），而非计划时间。
          </div>
        )}
        {isFuture && (
          <div className="text-[11px] text-gray-400">已选择未来日期，将记为该日打卡。</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-500">开始时间</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{ color: '#1C1C1E', WebkitTextFillColor: '#1C1C1E', caretColor: '#1C1C1E' }}
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 text-base outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">结束时间</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{ color: '#1C1C1E', WebkitTextFillColor: '#1C1C1E', caretColor: '#1C1C1E' }}
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 text-base outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div
          className={`text-center text-sm font-semibold rounded-xl py-2.5 ${
            durMin > 0 ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'
          }`}
        >
          {durMin > 0
            ? `本次时长：${fmtDur(durMin)}${crossDay ? '（跨天 · 次日结束）' : ''}`
            : '同一分钟内完成打卡（时长为 0）'}
        </div>
      </div>
    </Modal>
  )
}

export { shiftMinutes }
