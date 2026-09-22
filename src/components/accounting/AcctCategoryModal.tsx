import { useEffect, useState } from 'react'
import type { AcctCategory, TxnType } from '@/types'
import { Modal } from '@/components/common/Modal'
import { Icons } from '@/components/common/Icons'

interface Props {
  open: boolean
  onClose: () => void
  initial?: AcctCategory | null
  onSave: (data: Omit<AcctCategory, 'id' | 'order'>) => void
  onDelete?: (id: string) => void
}

const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5AC8FA', '#5856D6', '#AF52DE', '#FF2D55', '#8E8E93']
const EMOJIS = ['🍜', '🍔', '☕', '🚌', '🚕', '✈️', '🏠', '🛍️', '🎮', '💊', '🏥', '📚', '🎓', '💰', '🎁', '📈', '💼', '✨', '📦', '👕', '💡', '📱', '⚽', '🍺', '🎵', '🧾', '🐱', '🌟']

export function AcctCategoryModal({ open, onClose, initial, onSave, onDelete }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<TxnType | 'both'>('expense')
  const [emoji, setEmoji] = useState('🍜')
  const [color, setColor] = useState('#FF9500')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setType(initial.type)
      setEmoji(initial.emoji)
      setColor(initial.color)
    } else {
      setName('')
      setType('expense')
      setEmoji('🍜')
      setColor('#FF9500')
    }
  }, [open, initial])

  const valid = name.trim().length > 0

  const handleSave = () => {
    if (!valid) return
    onSave({
      name: name.trim(),
      type,
      emoji,
      color,
    })
    onClose()
  }

  const handleDelete = () => {
    if (initial && onDelete) onDelete(initial.id)
    onClose()
  }

  const typeOptions: { k: TxnType | 'both'; l: string }[] = [
    { k: 'expense', l: '支出' },
    { k: 'income', l: '收入' },
    { k: 'both', l: '通用' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '编辑分类' : '新建分类'}
      footer={
        <div className="flex items-center gap-2">
          {initial && onDelete && (
            <button
              onClick={handleDelete}
              className="w-10 h-11 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:scale-95"
              aria-label="删除"
            >
              <Icons.Trash size={18} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!valid}
            className={`flex-1 h-11 rounded-xl font-semibold text-white active:scale-95 transition ${
              valid ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            保存
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">分类名称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：餐饮"
            className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm"
          />
        </label>

        <div>
          <div className="text-xs text-gray-500 mb-2">用途</div>
          <div className="flex gap-2">
            {typeOptions.map((t) => (
              <button
                key={t.k}
                onClick={() => setType(t.k)}
                className={`flex-1 py-2 rounded-xl border text-sm transition ${
                  type === t.k ? 'border-primary bg-primary/5 text-gray-900' : 'border-gray-100 bg-white text-gray-600'
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2">图标</div>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${
                  emoji === e ? 'bg-primary/10 ring-1 ring-primary' : 'bg-gray-50'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2">颜色</div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
