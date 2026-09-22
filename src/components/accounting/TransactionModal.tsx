import { useEffect, useMemo, useState } from 'react'
import type { Transaction, AcctCategory, Account, TxnType } from '@/types'
import { Modal } from '@/components/common/Modal'
import { Icons } from '@/components/common/Icons'
import { fmtDate, dt } from '@/utils/date'

interface Props {
  open: boolean
  onClose: () => void
  categories: AcctCategory[]
  accounts: Account[]
  initial?: Transaction | null
  defaultType?: TxnType
  defaultAccountId?: string
  onSave: (data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDelete?: (id: string) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

export function TransactionModal({
  open,
  onClose,
  categories,
  accounts,
  initial,
  defaultType = 'expense',
  defaultAccountId,
  onSave,
  onDelete,
}: Props) {
  const [type, setType] = useState<TxnType>(defaultType)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(fmtDate(new Date()))
  const [time, setTime] = useState(dt.format(new Date(), 'HH:mm'))
  const [note, setNote] = useState('')

  // 打开时根据 initial / 默认值初始化表单
  useEffect(() => {
    if (!open) return
    if (initial) {
      setType(initial.type)
      setAmount(String(initial.amount))
      setCategoryId(initial.categoryId)
      setAccountId(initial.accountId)
      const d = new Date(initial.datetime)
      setDate(fmtDate(d))
      setTime(dt.format(d, 'HH:mm'))
      setNote(initial.note || '')
    } else {
      setType(defaultType)
      setAmount('')
      setCategoryId('')
      setAccountId(defaultAccountId || accounts[0]?.id || '')
      const now = new Date()
      setDate(fmtDate(now))
      setTime(dt.format(now, 'HH:mm'))
      setNote('')
    }
  }, [open, initial, defaultType, defaultAccountId, accounts])

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === type || c.type === 'both'),
    [categories, type]
  )

  const press = (k: string) => {
    setAmount((a) => {
      if (k === 'del') return a.slice(0, -1)
      if (k === '.') {
        if (a.includes('.')) return a
        return a === '' ? '0.' : a + '.'
      }
      // digit
      if (a.includes('.')) {
        const dec = a.split('.')[1] || ''
        if (dec.length >= 2) return a
      }
      if (a === '0') return k
      return a + k
    })
  }

  const amountNum = parseFloat(amount)
  const valid = amountNum > 0 && !!categoryId && !!accountId

  const handleSave = () => {
    if (!valid) return
    const datetime = new Date(`${date}T${time}`).getTime()
    onSave({
      type,
      amount: Math.round(amountNum * 100) / 100,
      categoryId,
      accountId,
      datetime,
      note: note.trim() || undefined,
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
      title={initial ? '编辑账目' : '记一笔'}
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
              valid ? (type === 'expense' ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-300'
            }`}
          >
            保存
          </button>
        </div>
      }
    >
      {/* 收/支切换 */}
      <div className="flex bg-[#F2F2F7] rounded-full p-0.5 mb-3">
        {([
          { k: 'expense', l: '支出', c: 'bg-red-500' },
          { k: 'income', l: '收入', c: 'bg-green-500' },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setType(t.k)}
            className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
              type === t.k ? `${t.c} text-white` : 'text-gray-500'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* 金额显示 */}
      <div className="text-center py-3">
        <span className="text-4xl font-bold text-gray-900 tabular-nums">
          {type === 'expense' ? '-' : '+'}¥{amount || '0'}
        </span>
      </div>

      {/* 数字键盘 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className="h-12 rounded-xl bg-white shadow-card text-lg font-medium active:scale-95 text-gray-800"
          >
            {k === 'del' ? <Icons.X size={18} className="mx-auto" /> : k}
          </button>
        ))}
      </div>

      {/* 分类选择 */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">分类</div>
        <div className="grid grid-cols-4 gap-2">
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition ${
                categoryId === c.id ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'
              }`}
            >
              <span className="text-xl">{c.emoji}</span>
              <span className="text-[11px] text-gray-600">{c.name}</span>
            </button>
          ))}
          {visibleCategories.length === 0 && (
            <div className="col-span-4 text-center text-xs text-gray-400 py-2">暂无分类，请先到「分类」中添加</div>
          )}
        </div>
      </div>

      {/* 账户选择 */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">账户</div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccountId(a.id)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-sm transition flex items-center gap-1.5 ${
                accountId === a.id
                  ? 'border-primary bg-primary/5 text-gray-900'
                  : 'border-gray-100 bg-white text-gray-600'
              }`}
            >
              <span>{a.emoji || '💳'}</span>
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* 日期 + 时间 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">日期</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">时间</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm"
          />
        </label>
      </div>

      {/* 备注 */}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注（可选）"
        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm"
      />
    </Modal>
  )
}
