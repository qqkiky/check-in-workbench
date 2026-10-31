import type { Account, AcctCategory, Transaction } from '@/types'

export interface BookkeepingItem {
  id: string; version: number; type: 'income' | 'expense'; amountCents: number
  accountName: string; date: string; note: string; createdAt: number
}
export function inboxTransaction(item: BookkeepingItem, accounts: Account[], categories: AcctCategory[]): Transaction | null {
  if (!item || !/^wxbook-[\w-]{1,60}$/.test(item.id) || !Number.isSafeInteger(item.version) || item.version < 1
    || !['income','expense'].includes(item.type) || !Number.isSafeInteger(item.amountCents) || item.amountCents <= 0 || item.amountCents > 1e12
    || typeof item.accountName !== 'string' || typeof item.note !== 'string' || item.note.length > 200
    || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(item.createdAt)) throw new Error('收到的记账内容不完整，未入账')
  const datetime = Date.parse(`${item.date}T12:00:00+08:00`)
  if (!Number.isFinite(datetime) || new Date(datetime + 8*3600000).toISOString().slice(0,10) !== item.date) throw new Error('记账日期不正确，未入账')
  // Resolve only against local account names. No default account and no account list upload.
  const matches = accounts.filter(account => account.name.trim() === item.accountName.trim())
  if (matches.length !== 1) return null
  const category = categories.find(category => category.name === (item.type === 'expense' ? '其他支出' : '其他收入') && (category.type === item.type || category.type === 'both'))
  if (!category) throw new Error('请在记账页添加“其他支出”和“其他收入”分类，再同步微信账目')
  return { id:item.id, type:item.type, amount:item.amountCents/100, accountId:matches[0].id, categoryId:category.id,
    datetime, note:item.note, createdAt:item.createdAt, updatedAt:item.createdAt }
}
