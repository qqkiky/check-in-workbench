import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Icons } from '@/components/common/Icons'
import { CategoryIcon } from '@/utils/iconLibrary'
import { dt } from '@/utils/date'
import { showToast } from '@/components/common/Toast'
import type { Category, TimelineEntry } from '@/types'

interface Props {
  open: boolean
  editEntry?: TimelineEntry | null
  defaultDate: string
  defaultStartTime: string
  categories: Category[]
  onClose: () => void
  onConfirm: (data: {
    id?: string
    date: string
    startTime: string
    endTime?: string
    content: string
    categoryId?: string
  }) => void
}

// 计算起止时间差（分钟），支持跨天，同分钟返回 0
function diffMinutes(start: string, end: string): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null
  let diff = eh * 60 + em - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60 // 跨天：结束时间视作次日
  return diff
}

// 在时间线上记一笔 / 编辑记事（支持起止时间，用于计算时长）
export function TimelineNoteModal({
  open,
  editEntry,
  defaultDate,
  defaultStartTime,
  categories,
  onClose,
  onConfirm,
}: Props) {
  const [startTime, setStartTime] = useState(defaultStartTime)
  const [endTime, setEndTime] = useState<string>('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    if (editEntry) {
      setStartTime(editEntry.startTime || '09:00')
      setEndTime(editEntry.endTime || '')
      setContent(editEntry.content || '')
      setCategoryId(editEntry.categoryId)
    } else {
      setStartTime(defaultStartTime)
      setEndTime('')
      setContent('')
      setCategoryId(undefined)
    }
  }, [open, editEntry, defaultStartTime])

  const minutes = diffMinutes(startTime, endTime)

  const handleConfirm = () => {
    if (!content.trim()) {
      showToast('写点内容吧')
      return
    }
    onConfirm({
      id: editEntry?.id,
      date: defaultDate,
      startTime,
      endTime: endTime || undefined,
      content: content.trim(),
      categoryId,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editEntry ? '编辑记事' : '记一笔'}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button fullWidth onClick={handleConfirm}>
            {editEntry ? '保存修改' : '保存'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Icons.Calendar size={14} />
          <span>{dt.format(new Date(defaultDate + 'T00:00:00'), 'yyyy/MM/dd')}（{defaultDate}）</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">开始时间</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">结束时间</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
            />
          </div>
        </div>

        {minutes != null && minutes > 0 && (
          <div className="text-[11px] text-gray-400">
            时长约 <span className="text-primary font-medium">{minutes >= 60 ? `${Math.floor(minutes / 60)}小时${minutes % 60}分` : `${minutes}分钟`}</span>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写点什么，比如：和老友通了电话、看了场电影…"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-2 block">分类（可选）</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryId(undefined)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                categoryId === undefined ? 'border-transparent text-white bg-gray-400' : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              无
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition flex items-center gap-1 ${
                  categoryId === c.id ? 'border-transparent text-white shadow-sm' : 'border-gray-200 bg-white text-gray-700'
                }`}
                style={categoryId === c.id ? { background: c.color } : undefined}
              >
                <CategoryIcon category={c} size={13} color={categoryId === c.id ? '#fff' : c.color} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
