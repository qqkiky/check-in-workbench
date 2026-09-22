import { useEffect, useMemo, useState } from 'react'
import type { Account, Transaction, Transfer } from '@/types'
import { Modal } from '@/components/common/Modal'
import { Icons } from '@/components/common/Icons'
import { formatMoney, computeBalances } from '@/utils/accounting'
import { fmtDate, dt } from '@/utils/date'

interface Props {
  open: boolean
  onClose: () => void
  accounts: Account[]
  /** 用于实时计算账户余额，给出「转账后余额」预览与余额不足提示 */
  transactions: Transaction[]
  transfers: Transfer[]
  initial?: Transfer | null
  defaultFromAccountId?: string
  onSave: (data: Omit<Transfer, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDelete?: (id: string) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

/** 账户横向选择条：禁用项用于避免转出=转入 */
function AccountPicker({
  accounts,
  value,
  disabledId,
  onPick,
  balances,
  accent,
}: {
  accounts: Account[]
  value: string
  disabledId?: string
  onPick: (id: string) => void
  balances: Record<string, number>
  accent: string
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
      {accounts.map((a) => {
        const disabled = a.id === disabledId
        const active = value === a.id
        return (
          <button
            key={a.id}
            disabled={disabled}
            onClick={() => onPick(a.id)}
            className={`shrink-0 px-3 py-2 rounded-xl border text-left transition ${
              disabled
                ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                : active
                  ? 'bg-white'
                  : 'border-gray-100 bg-white'
            }`}
            style={active && !disabled ? { borderColor: accent, background: `${accent}0D` } : undefined}
          >
            <div className="flex items-center gap-1.5 text-sm text-gray-800">
              <span>{a.emoji || '💳'}</span>
              {a.name}
            </div>
            <div className="text-[10px] text-gray-400 tabular-nums mt-0.5">
              {formatMoney(balances[a.id] ?? 0)}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function TransferModal({
  open,
  onClose,
  accounts,
  transactions,
  transfers,
  initial,
  defaultFromAccountId,
  onSave,
  onDelete,
}: Props) {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(fmtDate(new Date()))
  const [time, setTime] = useState(dt.format(new Date(), 'HH:mm'))
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setFromId(initial.fromAccountId)
      setToId(initial.toAccountId)
      setAmount(String(initial.amount))
      setFee(initial.fee ? String(initial.fee) : '')
      const d = new Date(initial.datetime)
      setDate(fmtDate(d))
      setTime(dt.format(d, 'HH:mm'))
      setNote(initial.note || '')
    } else {
      const first = defaultFromAccountId || accounts[0]?.id || ''
      setFromId(first)
      setToId(accounts.find((a) => a.id !== first)?.id || '')
      setAmount('')
      setFee('')
      const now = new Date()
      setDate(fmtDate(now))
      setTime(dt.format(now, 'HH:mm'))
      setNote('')
    }
  }, [open, initial, defaultFromAccountId, accounts])

  // 余额基线：编辑态需排除这笔转账自身，否则预览会重复计算
  const balances = useMemo(() => {
    const base = initial ? transfers.filter((t) => t.id !== initial.id) : transfers
    return computeBalances(accounts, transactions, base)
  }, [accounts, transactions, transfers, initial])

  const press = (k: string) => {
    setAmount((a) => {
      if (k === 'del') return a.slice(0, -1)
      if (k === '.') {
        if (a.includes('.')) return a
        return a === '' ? '0.' : a + '.'
      }
      if (a.includes('.')) {
        const dec = a.split('.')[1] || ''
        if (dec.length >= 2) return a
      }
      if (a === '0') return k
      return a + k
    })
  }

  const swap = () => {
    setFromId(toId)
    setToId(fromId)
  }

  const amountNum = parseFloat(amount) || 0
  const feeNum = parseFloat(fee) || 0
  const fromAcc = accounts.find((a) => a.id === fromId)
  const toAcc = accounts.find((a) => a.id === toId)

  const fromBefore = balances[fromId] ?? 0
  const toBefore = balances[toId] ?? 0
  const fromAfter = fromBefore - amountNum - feeNum
  const toAfter = toBefore + amountNum

  // 信用卡本就允许为负（欠款），不提示余额不足
  const insufficient = !!fromAcc && fromAcc.type !== 'card' && amountNum > 0 && fromAfter < 0

  const valid = amountNum > 0 && !!fromId && !!toId && fromId !== toId

  const handleSave = () => {
    if (!valid) return
    const datetime = new Date(`${date}T${time}`).getTime()
    onSave({
      fromAccountId: fromId,
      toAccountId: toId,
      amount: Math.round(amountNum * 100) / 100,
      fee: feeNum > 0 ? Math.round(feeNum * 100) / 100 : undefined,
      datetime,
      note: note.trim() || undefined,
    })
    onClose()
  }

  const handleDelete = () => {
    if (initial && onDelete) onDelete(initial.id)
    onClose()
  }

  const enoughAccounts = accounts.length >= 2

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '编辑转账' : '账户转账'}
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
            确认转账
          </button>
        </div>
      }
    >
      {!enoughAccounts ? (
        <div className="py-10 text-center text-sm text-gray-400">
          至少需要 2 个账户才能转账
          <div className="text-[12px] mt-1">请先到「账户」中添加</div>
        </div>
      ) : (
        <>
          {/* 金额 */}
          <div className="text-center py-2">
            <span className="text-4xl font-bold text-gray-900 tabular-nums">¥{amount || '0'}</span>
            {feeNum > 0 && (
              <div className="text-[11px] text-amber-600 mt-1">另扣手续费 {formatMoney(feeNum)}</div>
            )}
          </div>

          {/* 转出 → 转入 */}
          <div className="rounded-2xl bg-[#F2F2F7] p-2.5 mb-3">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-xs text-gray-500">转出账户</span>
              {fromAcc && (
                <span className="text-[11px] text-gray-400 tabular-nums">
                  余额 {formatMoney(fromBefore)}
                </span>
              )}
            </div>
            <AccountPicker
              accounts={accounts}
              value={fromId}
              disabledId={toId}
              onPick={setFromId}
              balances={balances}
              accent="#FF3B30"
            />

            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-gray-200" />
              <button
                onClick={swap}
                className="w-8 h-8 rounded-full bg-white shadow-card flex items-center justify-center text-gray-500 active:scale-90 transition"
                aria-label="对调转出与转入账户"
                title="对调"
              >
                <Icons.SwapVertical size={15} />
              </button>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-xs text-gray-500">转入账户</span>
              {toAcc && (
                <span className="text-[11px] text-gray-400 tabular-nums">
                  余额 {formatMoney(toBefore)}
                </span>
              )}
            </div>
            <AccountPicker
              accounts={accounts}
              value={toId}
              disabledId={fromId}
              onPick={setToId}
              balances={balances}
              accent="#34C759"
            />
          </div>

          {/* 转账后余额预览 */}
          {amountNum > 0 && fromAcc && toAcc && (
            <div
              className={`mb-3 px-3 py-2 rounded-xl text-[11px] ${
                insufficient ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  {fromAcc.emoji} {fromAcc.name}
                </span>
                <span className="tabular-nums text-gray-500">
                  {formatMoney(fromBefore)} <span className="text-gray-400">→</span>{' '}
                  <span className={insufficient ? 'text-amber-700 font-semibold' : 'text-red-500 font-semibold'}>
                    {formatMoney(fromAfter)}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-600">
                  {toAcc.emoji} {toAcc.name}
                </span>
                <span className="tabular-nums text-gray-500">
                  {formatMoney(toBefore)} <span className="text-gray-400">→</span>{' '}
                  <span className="text-green-600 font-semibold">{formatMoney(toAfter)}</span>
                </span>
              </div>
              {insufficient && (
                <div className="mt-1.5 text-amber-700">⚠️ 转出后余额为负，请确认该账户是否够用</div>
              )}
            </div>
          )}

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

          {/* 手续费 + 日期 + 时间 */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">手续费</span>
              <input
                type="number"
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
                className="h-10 px-2.5 rounded-xl border border-gray-200 bg-white text-sm tabular-nums min-w-0"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">日期</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 px-2 rounded-xl border border-gray-200 bg-white text-sm min-w-0"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">时间</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 px-2 rounded-xl border border-gray-200 bg-white text-sm min-w-0"
              />
            </label>
          </div>

          {/* 备注 */}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注（可选，如：还信用卡）"
            className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm"
          />

          <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
            转账只在账户之间划转资金，不计入收入与支出，也不影响预算进度；手续费会真实减少净资产。
          </p>
        </>
      )}
    </Modal>
  )
}
