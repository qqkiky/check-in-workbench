import { useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { Transaction, AcctCategory, Account, Transfer } from '@/types'
import { useStore } from '@/store'
import { Icons } from '@/components/common/Icons'
import { TransactionModal } from '@/components/accounting/TransactionModal'
import { AccountModal } from '@/components/accounting/AccountModal'
import { AcctCategoryModal } from '@/components/accounting/AcctCategoryModal'
import { TransferModal } from '@/components/accounting/TransferModal'
import {
  formatMoney,
  aggregateByCategory,
  monthRange,
  filterTransactions,
  filterTransfers,
  groupFlowByDay,
  summarize,
  summarizeTransfers,
  computeBalances,
  buildCSV,
  downloadCSV,
} from '@/utils/accounting'
import { fmtDate, dt } from '@/utils/date'

type SubTab = 'flow' | 'stats' | 'accounts' | 'categories'

interface PieDatum {
  name: string
  value: number
  color: string
}

function MiniDonut({ data, centerLabel, centerValue }: { data: PieDatum[]; centerLabel: string; centerValue: string }) {
  if (data.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">暂无数据</div>
  }
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-base font-bold text-gray-900">{centerValue}</span>
          <span className="text-[10px] text-gray-400">{centerLabel}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {data.slice(0, 6).map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div key={d.name} className="flex items-center gap-2 text-[12px]">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="flex-1 truncate text-gray-700">{d.name}</span>
              <span className="text-gray-500">{formatMoney(d.value)}</span>
              <span className="text-gray-400 w-8 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AccountingScreen() {
  const { transactions, acctCategories, accounts, settings, transfers } = useStore()
  const addTransaction = useStore((s) => s.addTransaction)
  const updateTransaction = useStore((s) => s.updateTransaction)
  const deleteTransaction = useStore((s) => s.deleteTransaction)
  const addAccount = useStore((s) => s.addAccount)
  const updateAccount = useStore((s) => s.updateAccount)
  const deleteAccount = useStore((s) => s.deleteAccount)
  const addAcctCategory = useStore((s) => s.addAcctCategory)
  const updateAcctCategory = useStore((s) => s.updateAcctCategory)
  const deleteAcctCategory = useStore((s) => s.deleteAcctCategory)
  const addTransfer = useStore((s) => s.addTransfer)
  const updateTransfer = useStore((s) => s.updateTransfer)
  const deleteTransfer = useStore((s) => s.deleteTransfer)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)
  const [tab, setTab] = useState<SubTab>('flow')

  // 弹出层状态
  const [txnOpen, setTxnOpen] = useState(false)
  const [editTxn, setEditTxn] = useState<Transaction | null>(null)
  const [accOpen, setAccOpen] = useState(false)
  const [editAcc, setEditAcc] = useState<Account | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [editCat, setEditCat] = useState<AcctCategory | null>(null)
  const [tfOpen, setTfOpen] = useState(false)
  const [editTf, setEditTf] = useState<Transfer | null>(null)
  const [tfFromId, setTfFromId] = useState<string | undefined>(undefined)

  // 流水筛选
  const [scope, setScope] = useState<'month' | 'all'>('month')
  const [fType, setFType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all')
  const [fCat, setFCat] = useState<string>('all')
  const [fAcc, setFAcc] = useState<string>('all')
  const [search, setSearch] = useState('')

  const catMap = useMemo(() => new Map(acctCategories.map((c) => [c.id, c])), [acctCategories])
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const defaultAccountId = accounts.find((a) => a.isDefault)?.id || accounts[0]?.id

  // 当月账目
  const monthTxns = useMemo(() => {
    const { start, end } = monthRange(viewYear, viewMonth)
    return transactions.filter((t) => t.datetime >= start.getTime() && t.datetime <= end.getTime())
  }, [transactions, viewYear, viewMonth])
  const monthSummary = summarize(monthTxns)

  // 当月转账（独立于收支统计）
  const monthTransfers = useMemo(() => {
    const { start, end } = monthRange(viewYear, viewMonth)
    return transfers.filter((t) => t.datetime >= start.getTime() && t.datetime <= end.getTime())
  }, [transfers, viewYear, viewMonth])

  // 流水列表：账目
  const flowTxns = useMemo(() => {
    if (fType === 'transfer') return [] // 只看转账时不显示账目
    const base = scope === 'month' ? monthTxns : transactions
    return filterTransactions(base, { type: fType, categoryId: fCat, accountId: fAcc, search })
  }, [monthTxns, transactions, scope, fType, fCat, fAcc, search])

  // 流水列表：转账（转账没有收支方向与分类，因此这两类筛选生效时不参与混排）
  const flowTransfers = useMemo(() => {
    if (fType === 'income' || fType === 'expense') return []
    if (fCat !== 'all') return []
    const base = scope === 'month' ? monthTransfers : transfers
    return filterTransfers(base, { accountId: fAcc, search })
  }, [monthTransfers, transfers, scope, fType, fCat, fAcc, search])

  const groups = groupFlowByDay(flowTxns, flowTransfers)
  const flowTransferSummary = summarizeTransfers(flowTransfers)

  // 各账户余额（已计入转账与手续费）
  const balances = useMemo(
    () => computeBalances(accounts, transactions, transfers),
    [accounts, transactions, transfers]
  )

  const openTransfer = (from?: string) => {
    setEditTf(null)
    setTfFromId(from)
    setTfOpen(true)
  }

  // 统计：月/年
  const [statMode, setStatMode] = useState<'month' | 'year'>('month')
  // 分类柱状图：支出/收入切换
  const [catView, setCatView] = useState<'expense' | 'income'>('expense')
  // 每日/每月收支柱状图：收支同显 / 仅收入 / 仅支出
  const [flowView, setFlowView] = useState<'both' | 'income' | 'expense'>('both')
  const statData = useMemo(() => {
    if (statMode === 'month') {
      const { start, end } = monthRange(viewYear, viewMonth)
      const txns = transactions.filter((t) => t.datetime >= start.getTime() && t.datetime <= end.getTime())
      const days = new Date(viewYear, viewMonth, 0).getDate()
      const daily = Array.from({ length: days }, (_, i) => {
        const day = i + 1
        const ds = new Date(viewYear, viewMonth - 1, day, 23, 59, 59).getTime()
        const dstart = new Date(viewYear, viewMonth - 1, day, 0, 0, 0).getTime()
        const dayTxns = txns.filter((t) => t.datetime >= dstart && t.datetime <= ds)
        const s = summarize(dayTxns)
        return { day: `${day}`, 收入: s.income, 支出: s.expense }
      })
      const expenseByCat = aggregateByCategory(txns, acctCategories, 'expense').map((x) => ({
        name: x.category.name,
        value: x.amount,
        color: x.category.color,
      }))
      const incomeByCat = aggregateByCategory(txns, acctCategories, 'income').map((x) => ({
        name: x.category.name,
        value: x.amount,
        color: x.category.color,
      }))
      return { daily, expenseByCat, incomeByCat, summary: summarize(txns) }
    } else {
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const { start, end } = monthRange(viewYear, m)
        const mTxns = transactions.filter((t) => t.datetime >= start.getTime() && t.datetime <= end.getTime())
        const s = summarize(mTxns)
        return { month: `${m}月`, 收入: s.income, 支出: s.expense }
      })
      const allYear = transactions.filter((t) => {
        const d = new Date(t.datetime)
        return d.getFullYear() === viewYear
      })
      const expenseByCat = aggregateByCategory(allYear, acctCategories, 'expense').map((x) => ({
        name: x.category.name,
        value: x.amount,
        color: x.category.color,
      }))
      const incomeByCat = aggregateByCategory(allYear, acctCategories, 'income').map((x) => ({
        name: x.category.name,
        value: x.amount,
        color: x.category.color,
      }))
      return { daily: monthly, expenseByCat, incomeByCat, summary: summarize(allYear) }
    }
  }, [statMode, transactions, viewYear, viewMonth, acctCategories])

  const yFmt = (v: number) => {
    if (v >= 10000) return `${(v / 10000).toFixed(1)}w`
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
    return `${v}`
  }

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setViewMonth(m)
    setViewYear(y)
  }

  const openAddTxn = () => {
    setEditTxn(null)
    setTxnOpen(true)
  }
  const openEditTxn = (t: Transaction) => {
    setEditTxn(t)
    setTxnOpen(true)
  }

  const handleExport = () => {
    const csv = buildCSV(flowTxns, acctCategories, accounts, flowTransfers)
    const fname = scope === 'month' ? `记账-${viewYear}-${String(viewMonth).padStart(2, '0')}.csv` : `记账-全部.csv`
    downloadCSV(fname, csv)
  }

  const totalBalance = accounts.reduce((s, a) => s + (balances[a.id] ?? 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900">记账</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openTransfer()}
              className="flex items-center gap-1 bg-white text-gray-600 px-3 py-1.5 rounded-full text-sm font-medium shadow-card active:scale-95"
            >
              <Icons.Transfer size={16} />
              转账
            </button>
            <button
              onClick={openAddTxn}
              className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-full text-sm font-medium active:scale-95"
            >
              <Icons.Plus size={16} />
              记一笔
            </button>
          </div>
        </div>

        {/* 当月汇总 */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <button onClick={() => shiftMonth(-1)} className="w-7 h-7 rounded-full bg-white shadow-card flex items-center justify-center text-gray-500 active:scale-95" aria-label="上一月">
            <Icons.ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold text-gray-700">{viewYear}年{viewMonth}月</span>
          <button onClick={() => shiftMonth(1)} className="w-7 h-7 rounded-full bg-white shadow-card flex items-center justify-center text-gray-500 active:scale-95" aria-label="下一月">
            <Icons.ChevronRight size={14} />
          </button>
        </div>

        <div className="bg-white rounded-2xl p-3 shadow-card grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-xl font-bold text-green-600">{formatMoney(monthSummary.income)}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">收入</div>
          </div>
          <div className="text-center border-l border-r border-gray-100">
            <div className="text-xl font-bold text-red-500">{formatMoney(monthSummary.expense)}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">支出</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{formatMoney(monthSummary.balance)}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">结余</div>
          </div>
        </div>

        {/* 子导航 */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {([
            { k: 'flow', l: '流水' },
            { k: 'stats', l: '统计' },
            { k: 'accounts', l: '账户' },
            { k: 'categories', l: '分类' },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`pill-tab whitespace-nowrap ${tab === t.k ? 'pill-tab-active' : 'pill-tab-inactive'}`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* 预算信息条：设置预算后常驻展示（预算 / 已支出 / 剩余可用） */}
        {settings.budget && settings.budget > 0 && (() => {
          const exp = monthSummary.expense
          const remaining = settings.budget - exp
          const ratio = exp / settings.budget
          const over = exp > settings.budget
          const near = !over && ratio >= 0.8
          const toneCls = over
            ? 'bg-red-50 border border-red-200'
            : near
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-blue-50 border border-blue-200'
          const textCls = over ? 'text-red-600' : near ? 'text-amber-700' : 'text-blue-700'
          return (
            <div className={`mx-3 mt-3 px-3 py-2.5 rounded-xl ${toneCls}`}>
              <div className="flex items-center gap-2 text-[12px] font-semibold">
                <span className="text-base leading-none">💰</span>
                <span className={textCls}>本月预算 {formatMoney(settings.budget)}</span>
                {over && <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">已超支</span>}
                {near && <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-400 text-white text-[10px] font-bold">接近上限</span>}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className={textCls}>已支出 {formatMoney(exp)}</span>
                <span className={`font-semibold ${over ? 'text-red-600' : textCls}`}>
                  {over ? `超支 ${formatMoney(-remaining)}` : `剩余可用 ${formatMoney(remaining)}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round(ratio * 100))}%`,
                    background: over ? '#EF4444' : near ? '#F59E0B' : '#3B82F6',
                  }}
                />
              </div>
            </div>
          )
        })()}

        {tab === 'flow' && (
          <div className="px-3 py-3">
            {/* 筛选栏 */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="flex bg-white rounded-full p-0.5 shadow-card">
                {([
                  { k: 'month', l: '本月' },
                  { k: 'all', l: '全部' },
                ] as const).map((s) => (
                  <button
                    key={s.k}
                    onClick={() => setScope(s.k)}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                      scope === s.k ? 'bg-primary text-white' : 'text-gray-500'
                    }`}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
              <div className="flex bg-white rounded-full p-0.5 shadow-card">
                {([
                  { k: 'all', l: '全部' },
                  { k: 'expense', l: '支出' },
                  { k: 'income', l: '收入' },
                  { k: 'transfer', l: '转账' },
                ] as const).map((s) => (
                  <button
                    key={s.k}
                    onClick={() => {
                      setFType(s.k)
                      // 转账没有收支分类，切过去时清掉分类筛选，避免列表意外为空
                      if (s.k === 'transfer') setFCat('all')
                    }}
                    className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition ${
                      fType === s.k ? 'bg-primary text-white' : 'text-gray-500'
                    }`}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExport}
                className="ml-auto flex items-center gap-1 text-[12px] text-gray-500 bg-white rounded-full px-3 py-1.5 shadow-card active:scale-95"
              >
                <Icons.Download size={14} />
                导出
              </button>
            </div>

            {/* 分类/账户/搜索 筛选 */}
            <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
              <select
                value={fCat}
                onChange={(e) => setFCat(e.target.value)}
                className="bg-white rounded-xl px-3 py-1.5 text-[12px] border border-gray-100 text-gray-600 max-w-[40%]"
              >
                <option value="all">全部分类</option>
                {acctCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>
              <select
                value={fAcc}
                onChange={(e) => setFAcc(e.target.value)}
                className="bg-white rounded-xl px-3 py-1.5 text-[12px] border border-gray-100 text-gray-600 max-w-[40%]"
              >
                <option value="all">全部账户</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-1.5 border border-gray-100 flex-1 min-w-[120px]">
                <Icons.Search size={14} className="text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索备注"
                  className="text-[12px] outline-none flex-1 min-w-0 bg-transparent"
                />
              </div>
            </div>

            {/* 转账小计：只看转账时给出划转总额与手续费 */}
            {fType === 'transfer' && flowTransferSummary.count > 0 && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between text-[11px]">
                <span className="text-indigo-700 font-medium">
                  共 {flowTransferSummary.count} 笔划转 {formatMoney(flowTransferSummary.amount)}
                </span>
                <span className="text-gray-500">
                  {flowTransferSummary.fee > 0 ? `手续费 ${formatMoney(flowTransferSummary.fee)}` : '无手续费'}
                </span>
              </div>
            )}

            {/* 流水分组列表（账目与转账按时间混排） */}
            {groups.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <Icons.Wallet size={32} className="mx-auto mb-2 text-gray-300" />
                <div className="text-sm">{fType === 'transfer' ? '还没有转账记录' : '本月还没有账目'}</div>
                {fType === 'transfer' ? (
                  <button onClick={() => openTransfer()} className="mt-3 text-primary text-sm font-medium">转一笔 →</button>
                ) : (
                  <button onClick={openAddTxn} className="mt-3 text-primary text-sm font-medium">记一笔 →</button>
                )}
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.dateKey} className="mb-4">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[12px] font-semibold text-gray-700">{g.dateKey}</span>
                    <span className="text-[11px] text-gray-400">
                      收 {formatMoney(g.income, { symbol: false })} · 支 {formatMoney(g.expense, { symbol: false })}
                      {g.transferAmount > 0 && ` · 转 ${formatMoney(g.transferAmount, { symbol: false })}`}
                    </span>
                  </div>
                  <div className="bg-white rounded-2xl shadow-card divide-y divide-gray-50">
                    {g.items.map((item) => {
                      // ---------- 转账条目 ----------
                      if (item.kind === 'transfer') {
                        const tr = item.transfer
                        const from = accMap.get(tr.fromAccountId)
                        const to = accMap.get(tr.toAccountId)
                        return (
                          <button
                            key={tr.id}
                            onClick={() => { setEditTf(tr); setTfOpen(true) }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
                          >
                            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500">
                              <Icons.Transfer size={17} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate flex items-center gap-1">
                                <span>{from?.emoji} {from?.name || '已删除账户'}</span>
                                <span className="text-gray-300">→</span>
                                <span>{to?.emoji} {to?.name || '已删除账户'}</span>
                              </div>
                              <div className="text-[11px] text-gray-400 truncate">
                                转账
                                {tr.fee ? ` · 手续费 ${formatMoney(tr.fee, { symbol: false })}` : ''}
                                {tr.note ? ` · ${tr.note}` : ''}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold tabular-nums text-indigo-600">
                                {formatMoney(tr.amount, { symbol: false })}
                              </div>
                              <div className="text-[10px] text-gray-400">{dt.format(new Date(tr.datetime), 'HH:mm')}</div>
                            </div>
                          </button>
                        )
                      }

                      // ---------- 账目条目 ----------
                      const t = item.txn
                      const cat = catMap.get(t.categoryId)
                      const acc = accMap.get(t.accountId)
                      return (
                        <button
                          key={t.id}
                          onClick={() => openEditTxn(t)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
                        >
                          <span
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg"
                            style={{ background: `${cat?.color || '#999'}22` }}
                          >
                            {cat?.emoji || '📦'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{cat?.name || '未分类'}</div>
                            <div className="text-[11px] text-gray-400">
                              {acc?.emoji} {acc?.name}
                              {t.note ? ` · ${t.note}` : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-sm font-semibold tabular-nums ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                              {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, { symbol: false })}
                            </div>
                            <div className="text-[10px] text-gray-400">{dt.format(new Date(t.datetime), 'HH:mm')}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'stats' && (
          <div className="px-3 py-3 space-y-3">
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => shiftMonth(-1)} className="w-7 h-7 rounded-full bg-white shadow-card flex items-center justify-center text-gray-500 active:scale-95" aria-label="上一期">
                <Icons.ChevronLeft size={14} />
              </button>
              <span className="text-sm font-semibold text-gray-700">
                {statMode === 'month' ? `${viewYear}年${viewMonth}月` : `${viewYear}年`}
              </span>
              <button onClick={() => shiftMonth(1)} className="w-7 h-7 rounded-full bg-white shadow-card flex items-center justify-center text-gray-500 active:scale-95" aria-label="下一期">
                <Icons.ChevronRight size={14} />
              </button>
              <div className="flex bg-white rounded-full p-0.5 shadow-card ml-2">
                {([
                  { k: 'month', l: '月' },
                  { k: 'year', l: '年' },
                ] as const).map((s) => (
                  <button
                    key={s.k}
                    onClick={() => setStatMode(s.k)}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                      statMode === s.k ? 'bg-primary text-white' : 'text-gray-500'
                    }`}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3 shadow-card grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{formatMoney(statData.summary.income)}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">收入</div>
              </div>
              <div className="text-center border-l border-r border-gray-100">
                <div className="text-lg font-bold text-red-500">{formatMoney(statData.summary.expense)}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">支出</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{formatMoney(statData.summary.balance)}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">结余</div>
              </div>
            </div>

            {/* 每日/每月收支柱状图 */}
            <div className="bg-white rounded-2xl p-4 shadow-card">
              <div className="flex bg-gray-100 rounded-full p-0.5 w-fit mb-3">
                {(
                  [
                    { k: 'both', l: `${statMode === 'month' ? '每日' : '每月'}收支` },
                    { k: 'income', l: `${statMode === 'month' ? '每日' : '每月'}收入` },
                    { k: 'expense', l: `${statMode === 'month' ? '每日' : '每月'}支出` },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.k}
                    onClick={() => setFlowView(o.k)}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                      flowView === o.k
                        ? o.k === 'income'
                          ? 'bg-green-600 text-white'
                          : o.k === 'expense'
                            ? 'bg-red-500 text-white'
                            : 'bg-primary text-white'
                        : 'text-gray-500'
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statData.daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" vertical={false} />
                    <XAxis dataKey={statMode === 'month' ? 'day' : 'month'} tick={{ fontSize: 10, fill: '#8E8E93' }} axisLine={{ stroke: '#E5E5EA' }} tickLine={false} interval={statMode === 'month' ? 4 : 0} />
                    <YAxis tick={{ fontSize: 10, fill: '#8E8E93' }} tickFormatter={yFmt} axisLine={false} tickLine={false} width={42} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatMoney(value), name]}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: 12 }}
                      labelStyle={{ color: '#1C1C1E', fontWeight: 600 }}
                    />
                    {flowView !== 'expense' && (
                      <Bar dataKey="收入" fill="#34C759" maxBarSize={14} radius={[3, 3, 0, 0]} />
                    )}
                    {flowView !== 'income' && (
                      <Bar dataKey="支出" fill="#FF3B30" maxBarSize={14} radius={[3, 3, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 分类柱状图（支出/收入切换，按类别独立展示便于对比） */}
            <div className="bg-white rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">分类统计（按金额排序）</h3>
                <div className="flex bg-gray-100 rounded-full p-0.5">
                  <button
                    onClick={() => setCatView('expense')}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                      catView === 'expense' ? 'bg-red-500 text-white' : 'text-gray-500'
                    }`}
                  >
                    支出
                  </button>
                  <button
                    onClick={() => setCatView('income')}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition ${
                      catView === 'income' ? 'bg-green-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    收入
                  </button>
                </div>
              </div>
              {((catView === 'expense' ? statData.expenseByCat : statData.incomeByCat).length === 0) ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  暂无{catView === 'expense' ? '支出' : '收入'}数据
                </div>
              ) : (
                <div style={{ width: '100%', height: Math.max(180, (catView === 'expense' ? statData.expenseByCat : statData.incomeByCat).length * 30) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={catView === 'expense' ? statData.expenseByCat : statData.incomeByCat}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: '#8E8E93' }}
                        tickFormatter={yFmt}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#1C1C1E' }}
                        axisLine={false}
                        tickLine={false}
                        width={68}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatMoney(value), catView === 'expense' ? '支出' : '收入']}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: 12 }}
                        labelStyle={{ color: '#1C1C1E', fontWeight: 600 }}
                      />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={18}>
                        {(catView === 'expense' ? statData.expenseByCat : statData.incomeByCat).map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* 分类占比环形图 */}
            <div className="bg-white rounded-2xl p-4 shadow-card">
              <h3 className="text-sm font-semibold mb-3">支出分类占比</h3>
              <MiniDonut data={statData.expenseByCat} centerLabel="总支出" centerValue={formatMoney(statData.summary.expense)} />
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-card">
              <h3 className="text-sm font-semibold mb-3">收入分类占比</h3>
              <MiniDonut data={statData.incomeByCat} centerLabel="总收入" centerValue={formatMoney(statData.summary.income)} />
            </div>
          </div>
        )}

        {tab === 'accounts' && (
          <div className="px-3 py-3">
            <div className="bg-white rounded-2xl p-4 shadow-card mb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] text-gray-500">净资产（所有账户余额合计）</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(totalBalance)}</div>
                </div>
                <button
                  onClick={() => openTransfer()}
                  disabled={accounts.length < 2}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium active:scale-95 ${
                    accounts.length < 2 ? 'bg-gray-100 text-gray-300' : 'bg-indigo-50 text-indigo-600'
                  }`}
                >
                  <Icons.Transfer size={14} />
                  转账
                </button>
              </div>
              {monthTransfers.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-400">
                  本月 {monthTransfers.length} 笔转账 · 划转{' '}
                  {formatMoney(summarizeTransfers(monthTransfers).amount)}
                  {summarizeTransfers(monthTransfers).fee > 0 &&
                    ` · 手续费 ${formatMoney(summarizeTransfers(monthTransfers).fee)}`}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {accounts.map((a) => {
                const bal = balances[a.id] ?? 0
                return (
                  <div
                    key={a.id}
                    className="w-full flex items-center gap-3 bg-white rounded-2xl p-3 shadow-card"
                  >
                    <button
                      onClick={() => { setEditAcc(a); setAccOpen(true) }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99]"
                    >
                      <span className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0" style={{ background: `${a.color}22` }}>
                        {a.emoji || '💳'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                          {a.name}
                          {a.isDefault && <span className="text-[10px] text-primary bg-primary/10 px-1.5 rounded">默认</span>}
                        </div>
                        <div className="text-[11px] text-gray-400">初始 {formatMoney(a.initialBalance || 0)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-semibold tabular-nums ${bal < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                          {formatMoney(bal)}
                        </div>
                      </div>
                    </button>
                    {/* 从该账户快速发起转账 */}
                    <button
                      onClick={() => openTransfer(a.id)}
                      disabled={accounts.length < 2}
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition ${
                        accounts.length < 2 ? 'bg-gray-50 text-gray-300' : 'bg-indigo-50 text-indigo-500'
                      }`}
                      aria-label={`从${a.name}转账`}
                      title="转账"
                    >
                      <Icons.Transfer size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => { setEditAcc(null); setAccOpen(true) }}
              className="w-full mt-3 flex items-center justify-center gap-1 py-3 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium active:scale-95"
            >
              <Icons.Plus size={16} /> 添加账户
            </button>
          </div>
        )}

        {tab === 'categories' && (
          <div className="px-3 py-3">
            {(['expense', 'income'] as const).map((dir) => {
              const list = acctCategories.filter((c) => c.type === dir || c.type === 'both')
              return (
                <div key={dir} className="mb-4">
                  <div className="text-[12px] font-semibold text-gray-500 mb-2 px-1">{dir === 'expense' ? '支出分类' : '收入分类'}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {list.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setEditCat(c); setCatOpen(true) }}
                        className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-white shadow-card active:scale-95"
                      >
                        <span className="text-2xl">{c.emoji}</span>
                        <span className="text-[12px] text-gray-600">{c.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => { setEditCat(null); setCatOpen(true) }}
                      className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl border border-dashed border-gray-300 text-gray-400 active:scale-95"
                    >
                      <Icons.Plus size={20} />
                      <span className="text-[11px]">新建</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 记一笔弹窗 */}
      <TransactionModal
        open={txnOpen}
        onClose={() => setTxnOpen(false)}
        categories={acctCategories}
        accounts={accounts}
        initial={editTxn}
        defaultAccountId={defaultAccountId}
        onSave={(data) => {
          if (editTxn) updateTransaction(editTxn.id, data)
          else addTransaction(data)
        }}
        onDelete={deleteTransaction}
      />

      {/* 账户弹窗 */}
      <AccountModal
        open={accOpen}
        onClose={() => setAccOpen(false)}
        initial={editAcc}
        onSave={(data) => {
          if (editAcc) updateAccount(editAcc.id, data)
          else addAccount(data)
        }}
        onDelete={deleteAccount}
      />

      {/* 转账弹窗 */}
      <TransferModal
        open={tfOpen}
        onClose={() => setTfOpen(false)}
        accounts={accounts}
        transactions={transactions}
        transfers={transfers}
        initial={editTf}
        defaultFromAccountId={tfFromId || defaultAccountId}
        onSave={(data) => {
          if (editTf) updateTransfer(editTf.id, data)
          else addTransfer(data)
        }}
        onDelete={deleteTransfer}
      />

      {/* 分类弹窗 */}
      <AcctCategoryModal
        open={catOpen}
        onClose={() => setCatOpen(false)}
        initial={editCat}
        onSave={(data) => {
          if (editCat) updateAcctCategory(editCat.id, data)
          else addAcctCategory(data)
        }}
        onDelete={deleteAcctCategory}
      />
    </div>
  )
}
