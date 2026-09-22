import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { CategoryIcon } from '@/utils/iconLibrary'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { dt, fmtDate, getLunarDay } from '@/utils/date'
import { showToast } from '@/components/common/Toast'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { TaskFormModal } from '@/components/tasks/TaskFormModal'

interface Props {
  taskId: string | null
  onBack: () => void
}

type Tab = 'base' | 'trends'

export function TaskDetailScreen({ taskId, onBack }: Props) {
  const { tasks, records, categories, deleteRecord, deleteTask, archiveTask, restoreTask } = useStore()
  const [tab, setTab] = useState<Tab>('base')
  const [editing, setEditing] = useState(false)
  const [showDeleteTask, setShowDeleteTask] = useState(false)
  const [pendingDeleteRecordId, setPendingDeleteRecordId] = useState<string | null>(null)

  const task = tasks.find((t) => t.id === taskId)
  const category = task ? categories.find((c) => c.id === task.categoryId) : null

  const taskRecords = useMemo(
    () =>
      records
        .filter((r) => r.taskId === taskId)
        .sort((a, b) => b.completedAt - a.completedAt),
    [records, taskId]
  )

  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {}
    taskRecords.forEach((r) => {
      map[r.date] = (map[r.date] || 0) + 1
    })
    return map
  }, [taskRecords])

  if (!task) {
    return (
      <div className="flex flex-col h-full">
        <header className="px-4 pt-3 pb-2 flex items-center gap-2">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center">
            <Icons.ArrowLeft size={18} />
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center text-gray-400">任务不存在</div>
      </div>
    )
  }

  const today = new Date()
  const totalSeconds = taskRecords.reduce((a, b) => a + b.durationSeconds, 0)

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="text-primary text-sm flex items-center gap-1 active:opacity-70">
            <Icons.ArrowLeft size={16} /> Do
          </button>
          <button
            onClick={() => setShowDeleteTask(true)}
            className="text-red-500 active:opacity-70"
            aria-label="删除任务"
          >
            <Icons.Trash size={20} />
          </button>
          {task.archivedAt ? (
            <button
              onClick={() => {
                restoreTask(task.id)
                showToast('已恢复')
              }}
              className="text-primary active:opacity-70"
              aria-label="恢复任务"
              title="恢复"
            >
              <Icons.RotateCcw size={20} />
            </button>
          ) : (
            <button
              onClick={() => {
                archiveTask(task.id)
                showToast('已归档')
                onBack()
              }}
              className="text-gray-500 active:opacity-70"
              aria-label="归档任务"
              title="归档"
            >
              <Icons.Archive size={20} />
            </button>
          )}
          <button onClick={() => setEditing(true)} className="text-primary active:opacity-70">
            <Icons.MoreHorizontal size={20} />
          </button>
        </div>
        <h1 className="text-2xl font-bold mb-3">详情</h1>
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab('base')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              tab === 'base' ? 'bg-gray-200 text-gray-900' : 'bg-white text-gray-500'
            }`}
          >
            基础
          </button>
          <button
            onClick={() => setTab('trends')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              tab === 'trends' ? 'bg-gray-200 text-gray-900' : 'bg-white text-gray-500'
            }`}
          >
            趋势
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-3">
        {tab === 'base' ? (
          <div className="space-y-3 mt-3">
            <div className="bg-white rounded-2xl p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    {category && <CategoryIcon category={category} size={14} />}
                    {category?.name || '未分类'}
                  </div>
                  <div className="text-lg font-bold text-gray-900">{task.title}</div>
                  {task.description && (
                    <div className="text-sm text-gray-500 mt-1">{task.description}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400">共</div>
                  <div className="text-2xl font-bold text-primary">{taskRecords.length}</div>
                  <div className="text-[10px] text-gray-400">次打卡</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 shadow-card">
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                <Icons.Calendar size={14} />
                <span>{dt.format(today, 'yyyy 年 M 月')}</span>
              </div>
              <MonthGrid records={taskRecords} />
            </div>

            <div className="bg-white rounded-2xl p-3 shadow-card">
              <h3 className="text-sm font-semibold mb-2">最近打卡</h3>
              {taskRecords.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400">还没有打卡记录</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {taskRecords.slice(0, 20).map((r) => (
                    <div key={r.id} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{r.date}</div>
                        <div className="text-xs text-gray-500">
                          {dt.format(new Date(r.completedAt), 'HH:mm:ss')}
                          {r.progressTotal && r.progress !== undefined && (
                            <span className="ml-2 text-orange-600">
                              +{r.progress}/{r.progressTotal}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setPendingDeleteRecordId(r.id)}
                        className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:scale-95"
                        aria-label="撤回打卡"
                      >
                        <Icons.Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 mt-3">
            <div className="bg-white rounded-2xl p-3 shadow-card">
              <CalendarHeatmap year={today.getFullYear()} data={heatmapData} />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-card">
              <h3 className="text-sm font-semibold mb-2">专注计时</h3>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-gray-500">总时长</div>
                  <div className="text-xl font-bold text-primary">
                    {Math.floor(totalSeconds / 3600)}h
                    {Math.floor((totalSeconds % 3600) / 60)}m
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">平均每次</div>
                  <div className="text-xl font-bold">
                    {taskRecords.length > 0
                      ? `${Math.floor(totalSeconds / taskRecords.length / 60)}m`
                      : '—'}
                  </div>
                </div>
              </div>
              {taskRecords.length > 0 && <TimeRing records={taskRecords} />}
              <div className="mt-3 text-xs text-gray-500">
                最常时段：{getPeakHour(taskRecords)}
              </div>
            </div>
          </div>
        )}
      </div>

      <TaskFormModal open={editing} taskId={taskId} onClose={() => setEditing(false)} />

      <ConfirmDialog
        open={showDeleteTask}
        title="删除任务"
        message="确定删除这个任务吗？历史打卡记录会保留。"
        confirmText="删除"
        danger
        onConfirm={() => {
          if (task) {
            deleteTask(task.id)
            showToast('已删除')
            setShowDeleteTask(false)
            onBack()
          }
        }}
        onCancel={() => setShowDeleteTask(false)}
      />

      <ConfirmDialog
        open={!!pendingDeleteRecordId}
        title="撤回打卡"
        message="确定撤回这次打卡记录吗？"
        confirmText="撤回"
        danger
        onConfirm={() => {
          if (pendingDeleteRecordId) {
            deleteRecord(pendingDeleteRecordId)
            showToast('已撤回')
            setPendingDeleteRecordId(null)
          }
        }}
        onCancel={() => setPendingDeleteRecordId(null)}
      />
    </div>
  )
}

function MonthGrid({ records }: { records: { date: string }[] }) {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const firstDay = new Date(y, m, 1).getDay()
  const startPad = firstDay === 0 ? 6 : firstDay - 1
  const set = new Set(records.map((r) => r.date))

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 mb-1">
        {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`p-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = today.getDate() === day && today.getMonth() === m
          const isChecked = set.has(dateStr)
          const d = new Date(y, m, day)
          return (
            <div
              key={day}
              className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs ${
                isToday ? 'ring-1 ring-primary' : ''
              }`}
              style={{
                background: isChecked ? '#FF3B30' : '#F2F2F7',
                color: isChecked ? 'white' : '#1C1C1E',
              }}
            >
              <span className="leading-none">{day}</span>
              <span className="text-[8px] leading-none mt-0.5 opacity-70">{getLunarDay(d)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimeRing({ records }: { records: { completedAt: number }[] }) {
  const buckets = [0, 0, 0, 0]
  records.forEach((r) => {
    const h = new Date(r.completedAt).getHours()
    if (h < 6) buckets[0]++
    else if (h < 12) buckets[1]++
    else if (h < 18) buckets[2]++
    else buckets[3]++
  })
  const max = Math.max(...buckets, 1)
  const size = 120
  const r = 48
  const stroke = 12
  const c = 2 * Math.PI * r
  let off = 0

  return (
    <div className="mt-3 flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F2F2F7" strokeWidth={stroke} />
        {[
          { color: '#5AC8FA', label: '00', v: buckets[0] },
          { color: '#FF9500', label: '06', v: buckets[1] },
          { color: '#FF3B30', label: '12', v: buckets[2] },
          { color: '#AF52DE', label: '18', v: buckets[3] },
        ].map((b) => {
          const len = (b.v / max) * c
          const arr = `${len} ${c}`
          const o = -off
          off += len
          return (
            <circle
              key={b.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={b.color}
              strokeWidth={stroke}
              strokeDasharray={arr}
              strokeDashoffset={o}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              opacity={b.v > 0 ? 1 : 0.15}
            />
          )
        })}
      </svg>
      <div className="flex-1 grid grid-cols-2 gap-1.5 text-xs">
        {[
          { label: '00', color: '#5AC8FA', v: buckets[0] },
          { label: '06', color: '#FF9500', v: buckets[1] },
          { label: '12', color: '#FF3B30', v: buckets[2] },
          { label: '18', color: '#AF52DE', v: buckets[3] },
        ].map((b) => (
          <div key={b.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
            <span className="text-gray-500">{b.label}时</span>
            <span className="font-semibold ml-auto">{b.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function getPeakHour(records: { completedAt: number }[]): string {
  const counts: Record<number, number> = {}
  records.forEach((r) => {
    const h = new Date(r.completedAt).getHours()
    counts[h] = (counts[h] || 0) + 1
  })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return '—'
  const [h] = entries[0]
  return `${String(h).padStart(2, '0')}:00 - ${String(Number(h) + 1).padStart(2, '0')}:00`
}