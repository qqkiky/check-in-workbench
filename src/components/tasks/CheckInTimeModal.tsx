import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { showToast } from '@/components/common/Toast'
import { dt, fmtDate } from '@/utils/date'
import { checkInClock, checkInTimes } from '@/utils/checkIn'
import { TextInput } from '@/components/common/TextField'

interface Props {
  open: boolean
  taskTitle: string
  occurrenceDate: string
  canRename: boolean
  defaultDate: string
  defaultStart: string
  defaultEnd: string
  onClose: () => void
  onConfirm: (start: string, end: string, date: string, title: string) => void
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
  occurrenceDate,
  canRename,
  defaultDate,
  defaultStart,
  defaultEnd,
  onClose,
  onConfirm,
}: Props) {
  const [title, setTitle] = useState(taskTitle)
  const [date, setDate] = useState(defaultDate)
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)

  useEffect(() => {
    if (open) {
      setTitle(taskTitle)
      setDate(defaultDate)
      setStart(defaultStart)
      setEnd(defaultEnd)
    }
  }, [open, taskTitle, defaultDate, defaultStart, defaultEnd])

  const isMakeup = occurrenceDate < fmtDate(new Date())
  const times = date && start && end ? checkInTimes(date,start,end) : null
  const durMin = times ? Math.floor(times.durationSeconds / 60) : 0
  const startClock = times ? checkInClock(times.startedAt,occurrenceDate) : ''
  const endClock = times ? checkInClock(times.completedAt,occurrenceDate) : ''

  const handleConfirm = () => {
    if (!times) {
      showToast('请选择日期和起止时间')
      return
    }
    if (!title.trim()) {
      showToast('请输入本次记录名称')
      return
    }
    onConfirm(start,end,date,title.trim())
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
      title={`${taskTitle} · ${isMakeup ? '补卡' : '打卡'}`}
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
        <p className="text-sm text-primary font-medium">任务归属 {dt.format(occurrenceDate, 'MM月dd日')} {dt.format(occurrenceDate, 'EEEE')}</p>
        {canRename && <div>
          <label className="block">
            <span className="text-xs text-gray-500">本次记录名称</span>
            <TextInput value={title} onChange={e => setTitle(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 text-base focus:ring-2 focus:ring-primary/30"/>
          </label>
          <p className="mt-1 text-xs text-gray-500">习惯名称 {taskTitle}</p>
        </div>}

        <label className="block">
          <span className="text-xs text-gray-500">实际开始日期</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ color: '#1C1C1E', WebkitTextFillColor: '#1C1C1E', caretColor: '#1C1C1E' }}
            className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-50 text-base outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

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
          {times && <div>{startClock === endClock ? endClock : `${startClock} – ${endClock}`} · {fmtDur(durMin)}</div>}
          {endClock.endsWith('⁺') && <div className="mt-1 text-xs font-normal">⁺ 表示次日</div>}
        </div>
      </div>
    </Modal>
  )
}

export { shiftMinutes }
