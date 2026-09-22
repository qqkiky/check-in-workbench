import { useEffect, useState } from 'react'
import type { Account, AccountType } from '@/types'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_EMOJI } from '@/types'
import { Modal } from '@/components/common/Modal'
import { Icons } from '@/components/common/Icons'

interface Props {
  open: boolean
  onClose: () => void
  initial?: Account | null
  onSave: (data: Omit<Account, 'id'>) => void
  onDelete?: (id: string) => void
}

const COLORS = ['#34C759', '#007AFF', '#5AC8FA', '#FF9500', '#FFCC00', '#FF3B30', '#FF2D55', '#AF52DE', '#5856D6', '#8E8E93']
const EMOJIS = ['💵', '🏦', '💳', '🔵', '🟢', '📦', '💰', '👛', '🪙', '🏧']

export function AccountModal({ open, onClose, initial, onSave, onDelete }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('cash')
  const [initialBalance, setInitialBalance] = useState('0')
  const [emoji, setEmoji] = useState('💵')
  const [color, setColor] = useState('#34C759')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setType(initial.type)
      setInitialBalance(String(initial.initialBalance || 0))
      setEmoji(initial.emoji || ACCOUNT_TYPE_EMOJI[initial.type])
      setColor(initial.color)
    } else {
      setName('')
      setType('cash')
      setInitialBalance('0')
      setEmoji('💵')
      setColor('#34C759')
    }
  }, [open, initial])

  const valid = name.trim().length > 0
  const balNum = parseFloat(initialBalance) || 0

  const handleSave = () => {
    if (!valid) return
    onSave({
      name: name.trim(),
      type,
      initialBalance: Math.round(balNum * 100) / 100,
      emoji,
      color,
    })
    onClose()
  }

  const handleDelete = () => {
    if (initial && onDelete) onDelete(initial.id)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '编辑账户' : '新建账户'}
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
          <span className="text-xs text-gray-500">账户名称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：招商银行"
            className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm"
          />
        </label>

        <div>
          <div className="text-xs text-gray-500 mb-2">账户类型</div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t)
                  setEmoji(ACCOUNT_TYPE_EMOJI[t])
                }}
                className={`py-2 rounded-xl border text-sm transition ${
                  type === t ? 'border-primary bg-primary/5 text-gray-900' : 'border-gray-100 bg-white text-gray-600'
                }`}
              >
                {ACCOUNT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">初始余额（元）</span>
          <input
            type="number"
            inputMode="decimal"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm tabular-nums"
          />
        </label>

        <div>
          <div className="text-xs text-gray-500 mb-2">图标</div>
          <div className="flex flex-wrap gap-2">
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
