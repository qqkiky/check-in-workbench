import type { Account, Transfer } from '@/types'
import type { BookkeepingItem } from './bookkeepingInbox'

export function inboxTransfer(item:BookkeepingItem,accounts:Account[]):Transfer|null {
  if(!item||!/^wxbook-[\w-]{1,60}$/.test(item.id)||!Number.isSafeInteger(item.version)||item.version<1||item.type!=='transfer'
    ||!Number.isSafeInteger(item.amountCents)||item.amountCents<=0||item.amountCents>1e12
    ||typeof item.fromAccount!=='string'||!item.fromAccount.trim()||typeof item.toAccount!=='string'||!item.toAccount.trim()
    ||typeof item.note!=='string'||item.note.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||!Number.isFinite(item.createdAt)
    ||item.feeCents!==undefined&&(!Number.isSafeInteger(item.feeCents)||item.feeCents<0||item.feeCents>1e12))throw new Error('收到的转账记录不完整，未入账')
  const datetime=Date.parse(item.date+'T12:00:00+08:00')
  if(!Number.isFinite(datetime)||new Date(datetime+8*3600000).toISOString().slice(0,10)!==item.date)throw new Error('转账日期不正确，未入账')
  const from=accounts.filter(account=>account.name.trim()===item.fromAccount!.trim()),to=accounts.filter(account=>account.name.trim()===item.toAccount!.trim())
  if(from.length!==1||to.length!==1||from[0].id===to[0].id)return null
  return {id:item.id,fromAccountId:from[0].id,toAccountId:to[0].id,amount:item.amountCents/100,fee:(item.feeCents||0)/100,datetime,note:item.note,createdAt:item.createdAt,updatedAt:item.createdAt}
}
