import type { Transaction, AcctCategory, Account, TxnType, Transfer } from '@/types'
import { fmtDate, dt } from '@/utils/date'

/** 金额格式化：¥1,234.56（千分位 + 两位小数） */
export function formatMoney(n: number, opts?: { sign?: boolean; symbol?: boolean }): string {
  const symbol = opts?.symbol === false ? '' : '¥'
  const sign = n < 0 ? '-' : opts?.sign ? '+' : ''
  const abs = Math.abs(n)
  const fixed = abs.toFixed(2)
  const [int, dec] = fixed.split('.')
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${symbol}${withSep}.${dec}`
}

/**
 * 单个账户余额
 * = 初始余额 + 收入 - 支出 + 转入金额 - （转出金额 + 手续费）
 * 转账在两个账户间对冲，因此不影响净资产；手续费是真实流失，会减少净资产。
 */
export function accountBalance(
  account: Account,
  transactions: Transaction[],
  transfers: Transfer[] = []
): number {
  let sum = account.initialBalance || 0
  for (const t of transactions) {
    if (t.accountId !== account.id) continue
    if (t.type === 'income') sum += t.amount
    else sum -= t.amount
  }
  for (const tr of transfers) {
    if (tr.fromAccountId === account.id) sum -= tr.amount + (tr.fee || 0)
    if (tr.toAccountId === account.id) sum += tr.amount
  }
  return sum
}

/** 所有账户余额映射 */
export function computeBalances(
  accounts: Account[],
  transactions: Transaction[],
  transfers: Transfer[] = []
): Record<string, number> {
  const map: Record<string, number> = {}
  accounts.forEach((a) => {
    map[a.id] = accountBalance(a, transactions, transfers)
  })
  return map
}

/** 按日分组（倒序），附带当日收/支合计 */
export function groupByDay(transactions: Transaction[]): Array<{
  dateKey: string
  items: Transaction[]
  income: number
  expense: number
}> {
  const map = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const key = fmtDate(new Date(t.datetime))
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return Array.from(map.entries())
    .map(([dateKey, items]) => {
      items.sort((a, b) => b.datetime - a.datetime)
      const income = items.filter((i) => i.type === 'income').reduce((s, i) => s + i.amount, 0)
      const expense = items.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0)
      return { dateKey, items, income, expense }
    })
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
}

// ===================== 转账 =====================

/** 流水条目：账目与转账混排展示时的统一载体 */
export type FlowItem =
  | { kind: 'txn'; id: string; datetime: number; txn: Transaction }
  | { kind: 'transfer'; id: string; datetime: number; transfer: Transfer }

export interface TransferFilter {
  accountId?: string | 'all' // 匹配转出或转入任一方
  search?: string
  from?: number
  to?: number
}

/** 转账筛选（账户维度匹配转出/转入双方） */
export function filterTransfers(transfers: Transfer[], f: TransferFilter): Transfer[] {
  const kw = (f.search || '').trim().toLowerCase()
  return transfers
    .filter((t) => {
      if (f.accountId && f.accountId !== 'all') {
        if (t.fromAccountId !== f.accountId && t.toAccountId !== f.accountId) return false
      }
      if (f.from !== undefined && t.datetime < f.from) return false
      if (f.to !== undefined && t.datetime > f.to) return false
      if (kw && !(t.note || '').toLowerCase().includes(kw)) return false
      return true
    })
    .sort((a, b) => b.datetime - a.datetime)
}

/**
 * 账目 + 转账 按日分组（倒序）
 * 当日的 income / expense 合计只统计账目，转账单独用 transferAmount 呈现，
 * 避免转账把收支数字撑大。
 */
export function groupFlowByDay(
  transactions: Transaction[],
  transfers: Transfer[]
): Array<{
  dateKey: string
  items: FlowItem[]
  income: number
  expense: number
  transferAmount: number
}> {
  const map = new Map<string, FlowItem[]>()
  const push = (datetime: number, item: FlowItem) => {
    const key = fmtDate(new Date(datetime))
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  transactions.forEach((t) => push(t.datetime, { kind: 'txn', id: t.id, datetime: t.datetime, txn: t }))
  transfers.forEach((t) =>
    push(t.datetime, { kind: 'transfer', id: t.id, datetime: t.datetime, transfer: t })
  )

  return Array.from(map.entries())
    .map(([dateKey, items]) => {
      items.sort((a, b) => b.datetime - a.datetime)
      let income = 0
      let expense = 0
      let transferAmount = 0
      items.forEach((i) => {
        if (i.kind === 'txn') {
          if (i.txn.type === 'income') income += i.txn.amount
          else expense += i.txn.amount
        } else {
          transferAmount += i.transfer.amount
        }
      })
      return { dateKey, items, income, expense, transferAmount }
    })
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
}

/** 汇总一批转账：总划转金额与总手续费（手续费是净资产的真实流失） */
export function summarizeTransfers(transfers: Transfer[]): { amount: number; fee: number; count: number } {
  let amount = 0
  let fee = 0
  transfers.forEach((t) => {
    amount += t.amount
    fee += t.fee || 0
  })
  return { amount, fee, count: transfers.length }
}

/** 按分类聚合金额（可指定收/支方向），按金额降序 */
export function aggregateByCategory(
  transactions: Transaction[],
  categories: AcctCategory[],
  type?: TxnType
): Array<{ category: AcctCategory; amount: number }> {
  const catMap = new Map<string, number>()
  transactions.forEach((t) => {
    if (type && t.type !== type) return
    catMap.set(t.categoryId, (catMap.get(t.categoryId) || 0) + t.amount)
  })
  return categories
    .map((c) => ({ category: c, amount: catMap.get(c.id) || 0 }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

/** 月范围（含首尾当天） */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  }
}

export interface TxnFilter {
  type?: TxnType | 'all'
  categoryId?: string | 'all'
  accountId?: string | 'all'
  search?: string
  from?: number // 时间戳
  to?: number // 时间戳
}

/** 通用筛选 */
export function filterTransactions(transactions: Transaction[], f: TxnFilter): Transaction[] {
  const kw = (f.search || '').trim().toLowerCase()
  return transactions
    .filter((t) => {
      if (f.type && f.type !== 'all' && t.type !== f.type) return false
      if (f.categoryId && f.categoryId !== 'all' && t.categoryId !== f.categoryId) return false
      if (f.accountId && f.accountId !== 'all' && t.accountId !== f.accountId) return false
      if (f.from !== undefined && t.datetime < f.from) return false
      if (f.to !== undefined && t.datetime > f.to) return false
      if (kw) {
        const note = (t.note || '').toLowerCase()
        if (!note.includes(kw)) return false
      }
      return true
    })
    .sort((a, b) => b.datetime - a.datetime)
}

/** 汇总某批交易的收入/支出/结余 */
export function summarize(transactions: Transaction[]): { income: number; expense: number; balance: number } {
  let income = 0
  let expense = 0
  transactions.forEach((t) => {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  })
  return { income, expense, balance: income - expense }
}

/** 生成 CSV 文本（含 UTF-8 BOM，Excel 直开中文不乱码） */
export function buildCSV(
  transactions: Transaction[],
  categories: AcctCategory[],
  accounts: Account[],
  transfers: Transfer[] = []
): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const accName = new Map(accounts.map((a) => [a.id, a.name]))
  const header = ['日期', '时间', '类型', '分类', '账户', '金额', '备注']

  type Row = { datetime: number; cells: string[] }
  const txnRows: Row[] = transactions.map((t) => {
    const d = new Date(t.datetime)
    return {
      datetime: t.datetime,
      cells: [
        fmtDate(d),
        dt.format(d, 'HH:mm'),
        t.type === 'income' ? '收入' : '支出',
        catName.get(t.categoryId) || '未分类',
        accName.get(t.accountId) || '未知账户',
        t.amount.toFixed(2),
        t.note || '',
      ],
    }
  })
  // 转账单独成行：类型标记为「转账」，账户列用「转出 → 转入」表达流向
  const transferRows: Row[] = transfers.map((t) => {
    const d = new Date(t.datetime)
    const feeNote = t.fee ? `手续费 ${t.fee.toFixed(2)}` : ''
    const note = [t.note || '', feeNote].filter(Boolean).join('；')
    return {
      datetime: t.datetime,
      cells: [
        fmtDate(d),
        dt.format(d, 'HH:mm'),
        '转账',
        '账户互转',
        `${accName.get(t.fromAccountId) || '未知账户'} → ${accName.get(t.toAccountId) || '未知账户'}`,
        t.amount.toFixed(2),
        note,
      ],
    }
  })
  const rows = [...txnRows, ...transferRows]
    .sort((a, b) => a.datetime - b.datetime)
    .map((r) => r.cells)
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const lines = [header, ...rows].map((r) => r.map((c) => escape(String(c))).join(','))
  return '﻿' + lines.join('\r\n')
}

/** 触发浏览器下载 CSV */
export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
