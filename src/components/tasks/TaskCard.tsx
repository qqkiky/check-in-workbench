import { useEffect, useState } from 'react'
import type { Task, CheckInRecord } from '@/types'
import { useStore } from '@/store'
import { Tag } from '@/components/common/Tag'
import { ProgressBar } from '@/components/common/ProgressBar'
import { Icons } from '@/components/common/Icons'
import { CategoryIcon } from '@/utils/iconLibrary'
import { secondsToHuman, dt } from '@/utils/date'
import { recurrenceShortLabel } from '@/utils/recurrence'

interface TaskCardProps {
  task: Task & { completed: boolean; record?: CheckInRecord }
  category?: { name: string; emoji: string; color: string }
  onCheckIn: () => void
  onDetail: () => void
  onArchive?: () => void
  onRestore?: () => void
  /** 紧凑模式：用于周视图按天分组列表，缩窄内边距 */
  compact?: boolean
  /** 该任务实例所属的真实日期（YYYY-MM-DD），用于正确判断「逾期」，默认按今天 */
  taskDate?: string
}

// 内联 SVG 图标 - 避免依赖 lucide-react
const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ClockIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

// 归档 / 恢复操作按钮
function ArchiveAction({ onArchive, onRestore }: { onArchive?: () => void; onRestore?: () => void }) {
  if (onRestore) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRestore()
        }}
        className="shrink-0 w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center active:scale-95"
        aria-label="恢复任务"
        title="恢复"
      >
        <Icons.RotateCcw size={16} />
      </button>
    )
  }
  if (onArchive) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onArchive()
        }}
        className="shrink-0 w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center active:scale-95"
        aria-label="归档任务"
        title="归档"
      >
        <Icons.Archive size={16} />
      </button>
    )
  }
  return null
}

export function TaskCard({ task, category, onCheckIn, onDetail, onArchive, onRestore, compact, taskDate }: TaskCardProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const schedLabel = task.scheduledTime || ''
  const padding = compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
  const recurLabel = recurrenceShortLabel(task)

  // 已完成状态：以 completed 为唯一判据（record 仅用于进度条展示，缺失也不影响「已完成」样式的显示）
  if (task.completed) {
    return (
      <div
        className={`bg-white ${padding} cursor-pointer card-hover transition-shadow ${compact ? '' : 'shadow-card rounded-2xl'}`}
        onClick={onDetail}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-gray-700">{schedLabel}</span>
            {task.recurrence !== 'none' && <span className="text-[10px] text-gray-400">↻</span>}
            {task.reminderEnabled && schedLabel && (
              <span className="text-primary/70" title="已开启到点提醒">
                <Icons.Bell size={12} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ArchiveAction onArchive={onArchive} onRestore={onRestore} />
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center checkmark-pop">
              <CheckIcon size={14} />
            </div>
          </div>
        </div>
        <div className="text-[15px] font-semibold text-gray-900 mb-1">{task.title}</div>
        {category && (
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <Tag color={category.color} bg={`${category.color}18`}>
              <span className="mr-0.5">
                <CategoryIcon category={category} size={12} />
              </span>
              {category.name}
            </Tag>
            {recurLabel && <Tag color="#8E8E93" bg="#F2F2F7">{recurLabel}</Tag>}
          </div>
        )}
        {task.description && (
          <div className="text-xs text-gray-500 line-clamp-1">{task.description}</div>
        )}
        {task.record?.progressTotal && task.record?.progress !== undefined && (
          <div className="mt-2 text-xs text-gray-500">
            <ProgressBar value={task.record?.progress ?? 0} total={task.record?.progressTotal ?? 0} color="#34C759" height={6} />
          </div>
        )}
      </div>
    )
  }

  // 待完成
  // 逾期判断必须以「任务所属的真实日期」为基准，而不是永远拿今天来比。
  // 否则周视图里周二/周三的任务会被套上「今天」的日期，误判为已全部逾期。
  const isOverdue = (() => {
    if (!task.scheduledTime) return false
    const [hh, mm] = task.scheduledTime.split(':').map(Number)
    const base = taskDate ? new Date(taskDate + 'T00:00:00') : new Date(now)
    base.setHours(hh, mm, 0, 0)
    const dayStart = new Date(base)
    dayStart.setHours(0, 0, 0, 0)
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    if (dayStart.getTime() > todayStart.getTime()) return false // 未来的日期永不逾期
    return base.getTime() < now
  })()

  return (
    <div className={`bg-white ${padding} ${compact ? '' : 'shadow-card rounded-2xl'} card-hover transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[13px] font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
              {schedLabel}
            </span>
            {schedLabel && (
              <span className={isOverdue ? 'text-red-400' : 'text-gray-400'}>
                <ClockIcon size={11} />
              </span>
            )}
            {task.reminderEnabled && schedLabel && (
              <span className={isOverdue ? 'text-red-400' : 'text-primary'} title="已开启到点提醒">
                <Icons.Bell size={12} />
              </span>
            )}
            {isOverdue && (
              <span className="text-[10px] text-red-500 bg-red-50 px-1.5 rounded">逾期</span>
            )}
          </div>
          <div
            className="text-[15px] font-semibold text-gray-900 mb-1 cursor-pointer active:opacity-70"
            onClick={onDetail}
          >
            {task.title}
          </div>
          {!compact && task.description && (
            <div className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{task.description}</div>
          )}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {category && (
              <Tag color={category.color} bg={`${category.color}18`}>
                <span className="mr-0.5"><CategoryIcon category={category} size={12} /></span>
                {category.name}
              </Tag>
            )}
            {recurLabel && (
              <Tag color="#8E8E93" bg="#F2F2F7">{recurLabel}</Tag>
            )}
            {task.target && task.unit && (
              <Tag color="#FF9500" bg="#FFF5E5">目标 {task.target}{task.unit}</Tag>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <ArchiveAction onArchive={onArchive} onRestore={onRestore} />
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCheckIn()
            }}
            className={`shrink-0 rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors active:scale-95 ${compact ? 'w-8 h-8' : 'w-10 h-10'}`}
            title="打卡"
          >
            <CheckIcon size={compact ? 13 : 16} />
          </button>
        </div>
      </div>
    </div>
  )
}