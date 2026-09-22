import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Icons } from '@/components/common/Icons'
import { CategoryIcon } from '@/utils/iconLibrary'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CategoryFormModal } from '@/components/tasks/CategoryFormModal'
import { useStore } from '@/store'
import type { Task, CategoryId, Recurrence } from '@/types'
import { fmtDate } from '@/utils/date'
import { showToast } from '@/components/common/Toast'

interface TaskFormModalProps {
  open: boolean
  taskId?: string | null
  defaultCategoryId?: CategoryId
  defaultScheduledDate?: string // YYYY-MM-DD，从周视图某天点进来时预填
  onClose: () => void
}

const WEEKDAYS = [
  { v: 1, l: '一' },
  { v: 2, l: '二' },
  { v: 3, l: '三' },
  { v: 4, l: '四' },
  { v: 5, l: '五' },
  { v: 6, l: '六' },
  { v: 0, l: '日' },
]

const RECURRENCE_OPTIONS: { v: Recurrence; l: string }[] = [
  { v: 'none', l: '不重复' },
  { v: 'daily', l: '每日' },
  { v: 'weekly', l: '每周' },
  { v: 'monthly', l: '每月' },
]

export function TaskFormModal({ open, taskId, defaultCategoryId, defaultScheduledDate, onClose }: TaskFormModalProps) {
  const { tasks, categories, addTask, updateTask, deleteTask } = useStore()
  const editing = taskId ? tasks.find((t) => t.id === taskId) : null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || 'morning')
  const [scheduledEnabled, setScheduledEnabled] = useState(true)
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [scheduledDate, setScheduledDate] = useState(fmtDate(new Date()))
  const [recurrence, setRecurrence] = useState<Recurrence>('weekly')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [monthDay, setMonthDay] = useState(1)
  const [targetEnabled, setTargetEnabled] = useState(false)
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderLead, setReminderLead] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitle(editing.title)
      setDescription(editing.description || '')
      setCategoryId(editing.categoryId)
      setScheduledEnabled(!!editing.scheduledTime)
      setScheduledTime(editing.scheduledTime || '09:00')
      setScheduledDate(editing.scheduledDate || fmtDate(new Date()))
      setRecurrence(
        editing.recurrence ??
          (editing.weekdays && editing.weekdays.length ? 'weekly' : 'daily')
      )
      setWeekdays(editing.weekdays || [1, 2, 3, 4, 5])
      setMonthDay(editing.monthDay ?? 1)
      setTargetEnabled(!!editing.target)
      setTarget(editing.target ? String(editing.target) : '')
      setUnit(editing.unit || '')
      setReminderEnabled(editing.reminderEnabled ?? !!editing.scheduledTime)
      setReminderLead(editing.reminderLead ?? 0)
    } else {
      setTitle('')
      setDescription('')
      setCategoryId(defaultCategoryId || 'morning')
      setScheduledEnabled(true)
      setScheduledTime('09:00')
      setScheduledDate(defaultScheduledDate || fmtDate(new Date()))
      setRecurrence('weekly')
      setWeekdays([1, 2, 3, 4, 5])
      setMonthDay(1)
      setTargetEnabled(false)
      setTarget('')
      setUnit('')
      setReminderEnabled(true)
      setReminderLead(0)
    }
  }, [open, editing, defaultCategoryId, defaultScheduledDate])

  const toggleWeekday = (v: number) => {
    setWeekdays((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort()
    )
  }

  const handleSave = () => {
    if (!title.trim()) {
      showToast('请填写任务标题')
      return
    }
    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId,
      scheduledTime: scheduledEnabled ? scheduledTime : undefined,
      scheduledDate,
      recurrence,
      weekdays: recurrence === 'weekly' ? weekdays : undefined,
      monthDay: recurrence === 'monthly' ? Math.min(31, Math.max(1, Number(monthDay) || 1)) : undefined,
      reminderEnabled: scheduledEnabled ? reminderEnabled : false,
      reminderLead: scheduledEnabled ? reminderLead : 0,
      target: targetEnabled && target ? Number(target) : undefined,
      unit: targetEnabled && target ? unit.trim() || undefined : undefined,
    }
    if (editing) {
      updateTask(editing.id, data)
      showToast('已更新')
    } else {
      addTask(data as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>)
      showToast('已添加')
    }
    onClose()
  }

  const handleDelete = () => {
    if (!editing) return
    deleteTask(editing.id)
    showToast('已删除')
    setShowDeleteConfirm(false)
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? '编辑任务' : '新任务'}
        footer={
          <div className="flex items-center gap-2">
            {editing && (
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                icon={<Icons.Trash size={16} />}
              >
                删除
              </Button>
            )}
            <Button fullWidth onClick={handleSave}>
              {editing ? '保存' : '添加'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* 标题 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">任务标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：阅读 30 分钟"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">备注（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充说明"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition resize-none"
            />
          </div>

          {/* 分类 */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">分类</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition flex items-center gap-1 ${
                    categoryId === c.id
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                  style={
                    categoryId === c.id
                      ? { background: c.color }
                      : undefined
                  }
                >
                  <span className="inline-flex align-middle"><CategoryIcon category={c} size={13} /></span>
                  {c.name}
                </button>
              ))}
              <button
                onClick={() => setShowCategoryForm(true)}
                className="px-3 py-1.5 rounded-full text-sm border border-dashed border-primary text-primary bg-white"
              >
                + 新建
              </button>
            </div>
          </div>

          {/* 计划时间（可选） */}
          <div>
            <label className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">计划时间（可选）</span>
              <button
                onClick={() => setScheduledEnabled(!scheduledEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  scheduledEnabled ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    scheduledEnabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
            {scheduledEnabled && (
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                style={{ color: '#1C1C1E', WebkitTextFillColor: '#1C1C1E', caretColor: '#1C1C1E' }}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
              />
            )}
          </div>

          {/* 计划日期（决定在周视图里落在哪一天） */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">计划日期</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={{ color: '#1C1C1E', WebkitTextFillColor: '#1C1C1E', caretColor: '#1C1C1E' }}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
            />
          </div>

          {/* 到点提醒（依赖计划时间） */}
          {scheduledEnabled && (
            <div>
              <label className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">到点提醒</span>
                <button
                  onClick={() => setReminderEnabled(!reminderEnabled)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    reminderEnabled ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      reminderEnabled ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
              {reminderEnabled && (
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 0, l: '准点' },
                    { v: 5, l: '提前5分' },
                    { v: 15, l: '提前15分' },
                    { v: 30, l: '提前30分' },
                    { v: 60, l: '提前1小时' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setReminderLead(o.v)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        reminderLead === o.v
                          ? 'border-transparent text-white bg-primary'
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 量化目标（可选） */}
          <div>
            <label className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">量化目标（可选）</span>
              <button
                onClick={() => setTargetEnabled(!targetEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  targetEnabled ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    targetEnabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
            {targetEnabled && (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="目标数值，如 1000"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
                />
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="单位，如 页"
                  className="w-20 px-3 py-2.5 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
                />
              </div>
            )}
          </div>

          {/* 重复 */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">重复</label>
            <div className="flex gap-1.5">
              {RECURRENCE_OPTIONS.map((o) => (
                <button
                  key={o.v}
                  onClick={() => setRecurrence(o.v)}
                  className={`flex-1 h-9 rounded-lg text-sm font-medium transition ${
                    recurrence === o.v ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            {recurrence === 'weekly' && (
              <div className="flex gap-1.5 mt-2">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.v}
                    onClick={() => toggleWeekday(w.v)}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium transition ${
                      weekdays.includes(w.v) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {w.l}
                  </button>
                ))}
              </div>
            )}
            {recurrence === 'monthly' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">每月</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={monthDay}
                  onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 px-3 py-2 rounded-xl bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition"
                />
                <span className="text-xs text-gray-500">号重复</span>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <CategoryFormModal
        open={showCategoryForm}
        onClose={() => setShowCategoryForm(false)}
        onSaved={(id) => setCategoryId(id)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除任务"
        message="确定删除这个任务吗？历史打卡记录会保留。"
        confirmText="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
