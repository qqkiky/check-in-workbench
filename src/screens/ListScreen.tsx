import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { dt, fmtDate } from '@/utils/date'
import { Icons } from '@/components/common/Icons'
import { CategoryIcon } from '@/utils/iconLibrary'
import { TaskFormModal } from '@/components/tasks/TaskFormModal'
import { Modal } from '@/components/common/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { showToast } from '@/components/common/Toast'
import type { CheckInRecord, Task } from '@/types'

export function ListScreen({ onBack }: { onBack?: () => void }) {
  const { tasks, records, categories, deleteRecord, deleteTask, archiveTask, restoreTask } = useStore()
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [editingRecord, setEditingRecord] = useState<CheckInRecord | null>(null)
  const [delTask, setDelTask] = useState<Task | null>(null)

  const activeTasks = useMemo(() => tasks.filter((t) => !t.archivedAt), [tasks])
  const archivedTasks = useMemo(() => tasks.filter((t) => t.archivedAt), [tasks])

  const baseTasks = view === 'archived' ? archivedTasks : activeTasks

  const filteredTasks = useMemo(() => {
    return baseTasks.filter((t) => {
      if (filterCat && t.categoryId !== filterCat) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [baseTasks, search, filterCat])

  const todayRecords = useMemo(
    () => records.filter((r) => r.date === fmtDate(new Date())),
    [records]
  )

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            {onBack && (
              <button
                onClick={onBack}
                className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-gray-700 active:scale-95"
                aria-label="返回"
              >
                <Icons.ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">列表</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center text-primary active:scale-95"
          >
            <Icons.Plus size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索任务"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={() => setShowFilter(true)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              filterCat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Icons.Filter size={16} />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1 bg-gray-100 rounded-full p-0.5 w-fit">
          <button
            onClick={() => setView('active')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              view === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            进行中 {activeTasks.length}
          </button>
          <button
            onClick={() => setView('archived')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              view === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            已归档 {archivedTasks.length}
          </button>
        </div>
      </header>

      {view === 'active' && todayRecords.length > 0 && (
        <div className="px-4 py-2">
          <div className="text-xs text-gray-500 mb-1">今天已打卡 {todayRecords.length} 项</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {todayRecords.map((r) => {
              const cat = categories.find((c) => c.id === r.categoryId)
              return (
                <button
                  key={r.id}
                  onClick={() => setEditingRecord(r)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 active:scale-95"
                  style={{
                    background: cat ? `${cat.color}15` : '#F2F2F7',
                    color: cat?.color || '#666',
                  }}
                >
                  <Icons.Check size={12} />
                  {r.taskTitle}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-24">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-sm">没有匹配的任务</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task, i) => {
              const cat = categories.find((c) => c.id === task.categoryId)
              const todayRec = todayRecords.find((r) => r.taskId === task.id)
              return (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl px-4 py-3 shadow-card animate-in fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-start gap-3">
                    {view === 'archived' ? (
                      // 已归档：仅显示静默归档标记
                      <div className="shrink-0 mt-0.5 w-9 h-9 rounded-full flex items-center justify-center bg-gray-50 text-gray-300">
                        <Icons.Archive size={15} />
                      </div>
                    ) : todayRec ? (
                      // 进行中且今日已打卡：纯展示完成标记（列表仅作展示，不提供打卡入口）
                      <div
                        className="shrink-0 mt-0.5 w-9 h-9 rounded-full flex items-center justify-center bg-green-500 text-white"
                        title="今日已打卡"
                      >
                        <Icons.Check size={16} />
                      </div>
                    ) : (
                      // 进行中且未打卡：仅展示状态圆点，不做任何打卡操作
                      <div className="shrink-0 mt-0.5 w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 text-gray-300">
                        <Icons.Clock size={15} />
                      </div>
                    )}
                      <div
                        className="flex-1 min-w-0 active:opacity-70"
                        onClick={() => {
                          setEditingTaskId(task.id)
                          setShowForm(true)
                        }}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                          <Icons.Clock size={11} />
                          <span>{task.scheduledTime || '未排期'}</span>
                          {task.recurrence !== 'none' && (
                            <span className="text-gray-400">
                              <Icons.Repeat size={10} />
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          {cat && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-md font-medium inline-flex items-center gap-1"
                              style={{ background: `${cat.color}15`, color: cat.color }}
                            >
                              <CategoryIcon category={cat} size={11} /> {cat.name}
                            </span>
                          )}
                          {task.target && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-600 font-medium">
                              目标 {task.target}{task.unit || ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {view === 'archived' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            restoreTask(task.id)
                            showToast('已恢复')
                          }}
                          className="shrink-0 w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center active:scale-95"
                          aria-label="恢复任务"
                          title="恢复"
                        >
                          <Icons.RotateCcw size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDelTask(task)
                          }}
                          className="shrink-0 w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center active:scale-95"
                          aria-label="删除任务"
                        >
                          <Icons.Trash size={15} />
                        </button>
                      )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={showFilter} onClose={() => setShowFilter(false)} title="筛选">
        <div className="space-y-2">
          <button
            onClick={() => {
              setFilterCat(null)
              setShowFilter(false)
            }}
            className={`w-full px-3 py-2.5 rounded-xl text-left text-sm ${!filterCat ? 'bg-primary text-white' : 'bg-gray-100'}`}
          >
            全部分类
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setFilterCat(c.id)
                setShowFilter(false)
              }}
                className={`w-full px-3 py-2.5 rounded-xl text-left text-sm flex items-center gap-2 ${
                  filterCat === c.id ? 'bg-primary text-white' : 'bg-gray-100'
                }`}
              >
                <CategoryIcon category={c} size={16} />
                <span>{c.name}</span>
              </button>
          ))}
        </div>
      </Modal>

      <TaskFormModal
        open={showForm}
        taskId={editingTaskId}
        onClose={() => {
          setShowForm(false)
          setEditingTaskId(null)
        }}
      />

      <Modal
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        title="打卡详情"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (editingRecord) {
                  deleteRecord(editingRecord.id)
                  showToast('已撤回')
                  setEditingRecord(null)
                }
              }}
              className="flex-1 h-10 rounded-xl bg-red-50 text-red-500 text-sm font-medium active:scale-95"
            >
              撤回
            </button>
            <button
              onClick={() => setEditingRecord(null)}
              className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-medium active:scale-95"
            >
              完成
            </button>
          </div>
        }
      >
        {editingRecord && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">任务</div>
              <div className="font-semibold mt-0.5">{editingRecord.taskTitle}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">完成时间</div>
              <div className="font-medium mt-0.5">
                {dt.format(new Date(editingRecord.completedAt), 'yyyy-MM-dd HH:mm:ss')}
              </div>
            </div>
            {editingRecord.progressTotal && (
              <div>
                <div className="text-xs text-gray-500">进度</div>
                <div className="font-medium mt-0.5">
                  {editingRecord.progress || 0} / {editingRecord.progressTotal}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!delTask}
        title="删除任务"
        message="确定删除这个任务吗？历史打卡记录会保留。"
        confirmText="删除"
        danger
        onConfirm={() => {
          if (delTask) {
            deleteTask(delTask.id)
            showToast('已删除')
            setDelTask(null)
          }
        }}
        onCancel={() => setDelTask(null)}
      />
    </div>
  )
}