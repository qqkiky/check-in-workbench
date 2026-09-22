import { useState } from 'react'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { Modal } from '@/components/common/Modal'
import { showToast } from '@/components/common/Toast'

export function NotesScreen({ onBack }: { onBack: () => void }) {
  const { notes, addNote, updateNote, deleteNote } = useStore()
  const [text, setText] = useState('')
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const save = () => {
    if (!text.trim()) {
      showToast('内容不能为空')
      return
    }
    addNote(text)
    setText('')
    showToast('已记录')
  }

  const startEdit = (n: { id: string; content: string }) => {
    setEditingId(n.id)
    setEditText(n.content)
  }

  const confirmEdit = () => {
    if (!editingId) return
    if (!editText.trim()) {
      showToast('内容不能为空')
      return
    }
    updateNote(editingId, editText)
    setEditingId(null)
    setEditText('')
    showToast('已更新')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7] flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center text-gray-700 active:scale-95"
          aria-label="返回"
        >
          <Icons.ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">记事本</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-3 space-y-3">
        {/* 新增 */}
        <div className="bg-white rounded-2xl p-3 shadow-card">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="随手记点什么，临时但想留住的内容…"
            rows={3}
            className="w-full px-2 py-1.5 bg-gray-50 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={save}
              className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium active:scale-95"
            >
              保存
            </button>
          </div>
        </div>

        {/* 列表 */}
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-gray-300">
              <Icons.FileText size={28} />
            </div>
            <p className="text-sm">还没有记事，记一条吧</p>
          </div>
        ) : (
          notes.map((n) => {
            const editing = editingId === n.id
            return (
              <div key={n.id} className="bg-white rounded-2xl px-4 py-3 shadow-card">
                {editing ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full px-2 py-1.5 bg-gray-50 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm active:scale-95"
                      >
                        取消
                      </button>
                      <button
                        onClick={confirmEdit}
                        className="px-4 py-1.5 rounded-full bg-primary text-white text-sm font-medium active:scale-95"
                      >
                        保存
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p
                      className="text-[15px] text-gray-900 whitespace-pre-wrap leading-relaxed"
                      onClick={() => startEdit(n)}
                    >
                      {n.content}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-gray-400">
                        {new Date(n.updatedAt > n.createdAt ? n.updatedAt : n.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {n.updatedAt > n.createdAt && <span className="ml-1 text-primary">已编辑</span>}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEdit(n)}
                          className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:scale-95"
                          aria-label="编辑记事"
                        >
                          <Icons.Edit size={15} />
                        </button>
                        <button
                          onClick={() => setShowDeleteId(n.id)}
                          className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center active:scale-95"
                          aria-label="删除记事"
                        >
                          <Icons.Trash size={15} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      <Modal
        open={!!showDeleteId}
        onClose={() => setShowDeleteId(null)}
        title="删除记事"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteId(null)}
              className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-700 text-sm active:scale-95"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (showDeleteId) deleteNote(showDeleteId)
                setShowDeleteId(null)
                showToast('已删除')
              }}
              className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-medium active:scale-95"
            >
              删除
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">确定删除这条记事吗？</p>
      </Modal>
    </div>
  )
}
