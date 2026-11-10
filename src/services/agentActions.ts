import { useStore } from '@/store'
import { flushPrivateStorage } from './appStorage'
import { fmtDate, dt } from '@/utils/date'
import { buildTodayAgenda } from './todayAgenda'
import { taskOccursOnDate, recurrenceShortLabel } from '@/utils/recurrence'
import { accountBalance, formatMoney } from '@/utils/accounting'
import { syncTasksToCalendar, isCalendarSyncEnabled } from '@/capacitor/task-calendar'
import type { Task, Transaction, Account, CheckInRecord } from '@/types'

export const AGENT_ACTIONS = ['list_tasks','add_task','update_task','complete_task','update_completion_time','reopen_task','delete_task','list_transactions','add_transaction','update_transaction','delete_transaction','list_accounts','add_account','update_account','delete_account','list_notes','add_note','update_note','delete_note','add_transfer'] as const
export interface AgentArgs {
  action: typeof AGENT_ACTIONS[number]
  pendingOnly?:boolean; query?: string; title?: string; content?: string; date?: string; time?: string
  completedDate?: string; completedTime?: string; startedTime?: string; sourceNote?: string; completed?: boolean
  targetDate?: string; startDate?: string; endDate?: string; duration?: number; recurrence?: string; weekdays?: number[]; monthDay?: number
  type?: string; amountCents?: number; account?: string; category?: string; note?: string
  name?: string; accountType?: string; initialBalanceCents?: number; fromAccount?: string; toAccount?: string; feeCents?: number
}
export interface PendingAgentAction { args: AgentArgs; guard: string; label: string }
export interface AgentTaskDraft {
  task: Task
  label: string
  record?: Omit<CheckInRecord,'categoryId'>
  completionCallId?: string
  note?: {id:string;guard:string;label:string;callId?:string}
}
export interface AgentResult { proposalId?:string; text: string; modelStatus: string; pending?: PendingAgentAction; draft?: AgentTaskDraft; callId?: string }
const fields = ['pendingOnly','completed','startedTime','sourceNote','action','query','title','content','date','time','completedDate','completedTime','targetDate','startDate','endDate','duration','recurrence','weekdays','monthDay','type','amountCents','account','category','note','name','accountType','initialBalanceCents','fromAccount','toAccount','feeCents']
function text(value: unknown, label: string, max=200): string {
  if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`请明确${label}`)
  return value.trim()
}
function date(value: unknown): string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00'))||fmtDate(new Date(value+'T00:00:00'))!==value)throw new Error('请明确有效日期')
  return value
}
function time(value: unknown): string {
  if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('请明确几点几分，以及上午或下午')
  return value
}
function money(value: unknown, allowZero=false, negative=false): number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||Math.abs(value)>1e12||(!negative&&value<0)||(!allowZero&&value===0))throw new Error('请明确金额，最多保留两位小数')
  return value/100
}
function one<T extends {id:string}>(items:T[], query:unknown, label:(item:T)=>string, exact=false):T {
  const q=text(query,'要操作的内容或名称')
  const same=items.filter(item=>item.id===q||label(item)===q)
  const matches=same.length?same:exact?[]:items.filter(item=>label(item).includes(q))
  if(matches.length!==1)throw new Error(matches.length?'找到多条，请补充完整名称、日期或记录编号后再操作':'没有找到对应内容，请补充准确名称')
  return matches[0]
}
function inRange(day:string,args:AgentArgs) { return (!args.startDate||day>=args.startDate)&&(!args.endDate||day<=args.endDate) }

function taskFields(args:AgentArgs,current:Task|null) {
  const recurrence=args.recurrence??current?.recurrence??'none'
  if(!['none','daily','weekly','monthly'].includes(recurrence))throw new Error('重复方式不正确')
  const patch:Partial<Task>={title:args.title!==undefined?text(args.title,'任务内容'):current?.title,scheduledDate:args.date!==undefined?date(args.date):current?.scheduledDate,scheduledTime:args.time!==undefined?(args.time===''?undefined:time(args.time)):current?.scheduledTime,recurrence:recurrence as Task['recurrence']}
  if(!patch.title)throw new Error('请补充任务内容')
  if(patch.scheduledTime&&!patch.scheduledDate&&recurrence==='none')throw new Error('请补充任务日期')
  patch.isQuick=recurrence==='none'&&!patch.scheduledDate&&!patch.scheduledTime
  patch.reminderEnabled=!!patch.scheduledTime&&(current?.reminderEnabled??true)
  if(args.duration!==undefined&&(!Number.isInteger(args.duration)||args.duration<1||args.duration>1440))throw new Error('请明确有效时长')
  patch.duration=args.duration??current?.duration??30
  patch.weekdays=args.weekdays??current?.weekdays;patch.monthDay=args.monthDay??current?.monthDay
  if(recurrence==='weekly'&&(!patch.weekdays?.length||patch.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)))throw new Error('请明确每周哪几天')
  if(recurrence==='monthly'&&(!Number.isInteger(patch.monthDay)||patch.monthDay!<1||patch.monthDay!>31))throw new Error('请明确每月几号')
  const label=`${patch.title} · ${recurrence==='none'?(patch.scheduledDate||'日期未定'):recurrenceShortLabel(patch as Task)} ${patch.scheduledTime||'时间未定'}`
  return {patch,label}
}

export async function saveAgentTasks(rows:{draft:AgentTaskDraft;categoryId:string}[]):Promise<AgentResult[]> {
  const state=useStore.getState(), noteIds=new Set<string>()
  const tasks:Task[]=[], records:CheckInRecord[]=[]
  for(const {draft,categoryId} of rows) {
    const existing=state.tasks.find(task=>task.id===draft.task.id)
    if(!state.categories.some(category=>category.id===categoryId))throw new Error('请为每条事项选择仍存在的分类')
    if(draft.note&&!existing) {
      const note=state.notes.find(item=>item.id===draft.note!.id)
      if(!note||JSON.stringify(note)!==draft.note.guard)throw new Error('原笔记已经变化，请重新发起转换')
      noteIds.add(note.id)
    }
    tasks.push({...draft.task,categoryId})
    if(draft.record)records.push({...draft.record,categoryId})
  }
  await state.saveAgentTaskBatch(tasks,records,[...noteIds])
  let calendarText=''
  if(tasks.some(task=>task.scheduledTime)) {
    if(!isCalendarSyncEnabled())calendarText='；尚未开启系统日历同步'
    else try{const latest=useStore.getState();await syncTasksToCalendar(latest.tasks,latest.records);calendarText='；已同步系统日历'}catch{calendarText='；日历同步暂未成功'}
  }
  return rows.map(({draft,categoryId})=>{
    const category=state.categories.find(item=>item.id===categoryId)!
    const completion=draft.record?'；已标记完成'+(draft.record.startedAt!==undefined?`（${Math.round(draft.record.durationSeconds/60)} 分钟）`:''):''
    const note=draft.note?'；已删除指定原笔记':''
    return {text:`已保存：${draft.label} · ${category.name}${completion}${note}${draft.task.scheduledTime?calendarText:''}`,modelStatus:`操作已在本机保存：事项 ${draft.task.title}［${draft.task.id}］${completion}${note}`}
  })
}

export async function executeWorkbench(raw: AgentArgs, approval?: PendingAgentAction): Promise<AgentResult> {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!fields.includes(key))||!AGENT_ACTIONS.includes(raw.action))throw new Error('助手返回了不支持的操作，未执行')
  const args=Object.fromEntries(Object.entries(raw).filter(([,value])=>value!==null&&value!==undefined)) as unknown as AgentArgs
  for(const [key,value] of Object.entries(args))if(['pendingOnly','completed'].includes(key)?typeof value!=='boolean':!['duration','monthDay','amountCents','initialBalanceCents','feeCents','weekdays'].includes(key)&&typeof value!=='string')throw new Error('助手返回的字段格式不正确，未执行')
  if(args.weekdays!==undefined&&(!Array.isArray(args.weekdays)||args.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)))throw new Error('请明确每周哪几天')
  if(args.note!==undefined&&args.note.length>1000)throw new Error('备注太长，请缩短后重试')
  const s=useStore.getState(), today=fmtDate(new Date())
  if(args.startDate)date(args.startDate);if(args.endDate)date(args.endDate)
  if(args.date)date(args.date);if(args.targetDate)date(args.targetDate)
  if(args.startDate&&args.endDate&&args.startDate>args.endDate)throw new Error('起止日期顺序不正确')
  const account=(name:unknown)=>one(s.accounts,name,item=>item.name,true)
  const accountName=(id:string)=>s.accounts.find(item=>item.id===id)?.name||'已移除账户'
  const taskLabel=(item:Task)=>`${item.title}`
  const taskList=s.tasks.filter(item=>!item.archivedAt)
  const selectTask=()=>one(args.targetDate?taskList.filter(item=>item.recurrence!=='none'||item.scheduledDate===args.targetDate):taskList,args.query,taskLabel)
  const txnLabel=(item:Transaction)=>`${fmtDate(new Date(item.datetime))} ${item.type==='income'?'收入':'支出'} ${formatMoney(item.amount)} ${accountName(item.accountId)} ${item.note||''}`
  const txns=()=>s.transactions.filter(item=>inRange(fmtDate(new Date(item.datetime)),args)&&(!args.date||fmtDate(new Date(item.datetime))===date(args.date))&&(!args.type||item.type===args.type)&&(!args.account||item.accountId===account(args.account).id))
  let run:(()=>void)|undefined, label='', guard='', noteId:string|undefined, calendar=false, untimedTask=false
  if(args.action==='list_tasks') {
    const selected=taskList.filter(item=>!args.query||item.title.includes(args.query)||item.id===args.query)
    const start=args.date||args.startDate,end=args.date||args.endDate
    if((start&&!end)||(!start&&end))throw new Error('请提供查询的起止日期')
    if(start&&end&&dt.differenceInDays(new Date(end+'T00:00:00'),new Date(start+'T00:00:00'))>366)throw new Error('请把待办查询范围缩短到一年内')
    const allRows=start&&end?dt.eachDayOfInterval({start:new Date(start+'T00:00:00'),end:new Date(end+'T00:00:00')}).flatMap(day=>selected.filter(item=>taskOccursOnDate(item,day)).map(item=>({item,day:fmtDate(day)}))):selected.map(item=>({item,day:item.scheduledDate||today}))
    const rows=args.pendingOnly&&start===today&&end===today?buildTodayAgenda(s.tasks,s.records,new Date()).pending.map(row=>({item:row.task,day:row.dateKey})):args.pendingOnly?allRows.filter(({item,day})=>!s.records.some(record=>record.taskId===item.id&&(item.recurrence==='none'||record.date===day))):allRows
    return {text:rows.length?rows.slice(0,50).map(({item,day})=>`${s.records.some(record=>record.taskId===item.id&&(item.recurrence==='none'||record.date===day))?'✅':'□'} ${start?day:recurrenceShortLabel(item)||item.scheduledDate||'未指定日期'} ${item.scheduledTime||''} ${item.title}［${item.id}］`).join('\n')+(rows.length>50?`\n共${rows.length}项，仅展示前50项`:''):'没有符合条件的待办',modelStatus:'查询已在本机完成，结果仅向用户显示'}
  }
  if(args.action==='add_task'||args.action==='update_task') {
    const current=args.action==='update_task'?selectTask():null
    const {patch,label:taskLabel}=taskFields(args,current)
    label=taskLabel;calendar=true;untimedTask=!patch.scheduledTime
    if(!current) {
      const now=Date.now(),id=crypto.randomUUID()
      const task={...patch,id,createdAt:now,updatedAt:now,categoryId:'',reminderLead:0} as Task
      const draft:AgentTaskDraft={task,label}
      if(args.completed||args.startedTime||args.completedTime||args.completedDate) {
        const day=patch.scheduledDate||(args.completedDate?date(args.completedDate):today)
        const endDay=args.completedDate?date(args.completedDate):day
        const completedAt=args.completedTime?new Date(`${endDay}T${time(args.completedTime)}:00`).getTime():now
        const startedAt=args.startedTime?new Date(`${day}T${time(args.startedTime)}:00`).getTime():undefined
        if(args.completedDate&&!args.completedTime)throw new Error('请明确实际完成时间')
        if(completedAt>now+60000||startedAt!==undefined&&startedAt>completedAt)throw new Error('请核对实际开始与完成时间，尚未保存')
        if(!task.scheduledDate&&task.recurrence==='none'){
          task.scheduledDate=day;task.isQuick=false
          draft.label=`${task.title} · ${day} ${task.scheduledTime||'时间未定'}`
        }
        if(startedAt!==undefined&&args.duration===undefined)task.duration=Math.max(1,Math.round((completedAt-startedAt)/60000))
        draft.record={id:`${id}-completed`,taskId:id,taskTitle:task.title,date:day,startedAt,completedAt,durationSeconds:startedAt===undefined?0:Math.round((completedAt-startedAt)/1000)}
      }
      if(args.sourceNote) {
        const note=one(s.notes,args.sourceNote,item=>item.content)
        draft.note={id:note.id,guard:JSON.stringify(note),label:note.content.slice(0,100)}
      }
      const category=s.categories.find(cat=>cat.id===args.category||cat.name===args.category)
      if(category)draft.task.categoryId=category.id
      return {text:label,modelStatus:'事项已整理，等待用户选择分类并保存，尚未写入',draft}
    }
    const changesCycle=(args.recurrence!==undefined&&args.recurrence!==current.recurrence)
      ||args.weekdays!==undefined||args.monthDay!==undefined
    if(!changesCycle&&current.recurrence!=='none'&&args.date&&args.date!==(args.targetDate||today)) {
      const day=args.targetDate||today
      if(!taskOccursOnDate(current,new Date(day+'T00:00:00')))throw new Error('原日期没有这项习惯，请明确要移动哪一天')
      if(s.records.some(record=>record.taskId===current.id&&record.date===day))throw new Error('这一次已经完成，请明确要移动哪一天的未完成习惯')
      const {id,createdAt,updatedAt,...base}=current
      run=()=>{s.updateTask(current.id,{excludedDates:[...new Set([...(current.excludedDates||[]),day])]});s.addTask({...base,...patch,recurrence:'none',weekdays:undefined,monthDay:undefined,excludedDates:[],isQuick:false} as Omit<Task,'id'|'createdAt'|'updatedAt'>)}
    } else run=()=>s.updateTask(current.id,patch)
  } else if(args.action==='complete_task'||args.action==='update_completion_time'||args.action==='reopen_task') {
    if(args.action==='reopen_task'&&(args.time||args.completedTime||args.completedDate))throw new Error('修改完成时间请使用 update_completion_time；本次保留已完成状态')
    const task=selectTask(), taskRecords=s.records.filter(item=>item.taskId===task.id)
    const day=args.date?date(args.date):args.targetDate?date(args.targetDate):task.recurrence==='none'?(taskRecords[0]?.date||task.scheduledDate||today):today
    if(!day)throw new Error('请明确完成日期')
    const record=taskRecords.find(item=>item.date===day)
    label=`${day} ${task.title}`;calendar=true
    if(args.action==='reopen_task')run=()=>{if(record)s.deleteRecord(record.id)}
    else {
      if(args.action==='update_completion_time'&&!record)throw new Error('没有找到这一天的完成记录，请明确要修改的任务和日期')
      const completionTime=args.completedTime??args.time
      if((args.action==='update_completion_time'||args.completedDate)&&!completionTime)throw new Error('请明确实际完成时间，格式为 HH:mm')
      const completionDay=args.completedDate?date(args.completedDate):record?fmtDate(new Date(record.completedAt)):today
      const completedAt=completionTime?new Date(`${completionDay}T${time(completionTime)}:00`).getTime():record?.completedAt??Date.now()
      if(completedAt>Date.now()+60000)throw new Error('完成时间不能晚于现在，请核对实际完成日期和时间')
      const startedAt=record?.startedAt??(!record&&args.startedTime?new Date(`${day}T${time(args.startedTime)}:00`).getTime():undefined)
      if(startedAt!==undefined&&completedAt<startedAt)throw new Error('完成时间早于开始时间，请先核对开始时间；本次保留原记录')
      if(completionTime)label+=`；完成时间 ${completionDay} ${completionTime}`
      run=record?()=>{if(completionTime)s.updateRecord(record.id,{completedAt,durationSeconds:record.startedAt!==undefined?Math.round((completedAt-record.startedAt)/1000):record.durationSeconds})}:()=>s.addRecord({taskId:task.id,taskTitle:task.title,categoryId:task.categoryId,date:day,startedAt,completedAt,durationSeconds:startedAt===undefined?0:Math.round((completedAt-startedAt)/1000)})
    }
  } else if(args.action==='delete_task') {
    const task=selectTask();label=task.title;guard=JSON.stringify(task);calendar=true;run=()=>s.deleteTask(task.id)
  } else if(args.action==='list_transactions') {
    const categories=args.category?s.acctCategories.filter(item=>(item.name===args.category||item.id===args.category)&&(!args.type||item.type===args.type||item.type==='both')):[]
    if(args.category&&categories.length!==1)throw new Error('请明确唯一的收支分类名称，必要时补充收入或支出')
    if(args.amountCents!==undefined)money(args.amountCents)
    const rows=txns().filter(item=>(!args.query||txnLabel(item).includes(args.query)||item.id===args.query)&&(!args.category||item.categoryId===categories[0].id)&&(args.amountCents===undefined||Math.round(item.amount*100)===args.amountCents))
    const sum=(type:string)=>rows.filter(item=>item.type===type).reduce((total,item)=>total+Math.round(item.amount*100),0)/100
    return {text:`共 ${rows.length} 笔，收入 ${formatMoney(sum('income'))}，支出 ${formatMoney(sum('expense'))}\n`+rows.slice(0,50).map(item=>`${txnLabel(item)}［${item.id}］`).join('\n')+(rows.length>50?'\n仅展示前50笔，合计包含全部匹配账目':''),modelStatus:'查账已在本机计算，金额和明细未发给模型'}
  } else if(['add_transaction','update_transaction','delete_transaction'].includes(args.action)) {
    const current=args.action==='add_transaction'?null:one(s.transactions.filter(item=>inRange(fmtDate(new Date(item.datetime)),args)&&(!args.targetDate||fmtDate(new Date(item.datetime))===args.targetDate)),args.query,item=>item.note||txnLabel(item))
    if(args.action==='delete_transaction'){label=txnLabel(current!);guard=JSON.stringify(current);run=()=>s.deleteTransaction(current!.id)}
    else {
      const type=args.type??current?.type
      if(type!=='income'&&type!=='expense')throw new Error('请明确收入还是支出')
      const acc=args.account?account(args.account):current?s.accounts.find(item=>item.id===current.accountId):null
      if(!acc)throw new Error('请明确使用哪个账户，名称须与记账页一致')
      const amount=args.amountCents!==undefined?money(args.amountCents):current?.amount
      if(amount===undefined)throw new Error('请补充金额')
      const fallback=s.acctCategories.find(item=>item.name===(type==='income'?'其他收入':'其他支出'))
      const cat=args.category?one(s.acctCategories.filter(item=>item.type===type||item.type==='both'),args.category,item=>item.name,true):current?s.acctCategories.find(item=>item.id===current.categoryId&&(item.type===type||item.type==='both'))||fallback:fallback
      if(!cat)throw new Error('请先在记账页添加对应收支分类')
      const day=args.date?date(args.date):current?fmtDate(new Date(current.datetime)):today
      const oldTime=current?`${String(new Date(current.datetime).getHours()).padStart(2,'0')}:${String(new Date(current.datetime).getMinutes()).padStart(2,'0')}`:'12:00'
      const datetime=args.date||args.time||!current?new Date(`${day}T${args.time?time(args.time):oldTime}:00`).getTime():current.datetime
      const value={type,amount,accountId:acc.id,categoryId:cat.id,datetime,note:args.note!==undefined?args.note.trim():current?.note} as Omit<Transaction,'id'|'createdAt'|'updatedAt'>
      label=`${day} ${acc.name} ${type==='income'?'收入':'支出'} ${formatMoney(amount)}`
      run=current?()=>s.updateTransaction(current.id,value):()=>s.addTransaction(value)
    }
  } else if(args.action==='list_accounts') {
    const rows=s.accounts.filter(item=>!args.query||item.name.includes(args.query)||item.id===args.query)
    return {text:rows.length?rows.map(item=>`${item.name}：${formatMoney(accountBalance(item,s.transactions,s.transfers))}`).join('\n'):'没有对应账户',modelStatus:'账户余额已在本机计算，未发给模型'}
  } else if(['add_account','update_account','delete_account'].includes(args.action)) {
    const current=args.action==='add_account'?null:account(args.query)
    if(args.action==='delete_account') {
      if(s.transactions.some(item=>item.accountId===current!.id)||s.transfers.some(item=>item.fromAccountId===current!.id||item.toAccountId===current!.id))throw new Error('该账户已有账目或转账，不能通过助手删除')
      label=current!.name;guard=JSON.stringify(current);run=()=>s.deleteAccount(current!.id)
    } else {
      const name=args.name!==undefined?text(args.name,'账户名称'):current?.name
      if(!name)throw new Error('请补充账户名称')
      if(s.accounts.some(item=>item.name===name&&item.id!==current?.id))throw new Error('已有同名账户，请使用不同名称')
      const type=args.accountType??current?.type
      if(!['cash','bank','card','alipay','wechat','other'].includes(type||''))throw new Error('请明确账户类型：现金、银行卡、信用卡、支付宝、微信或其他')
      const initialBalance=args.initialBalanceCents!==undefined?money(args.initialBalanceCents,true,true):current?.initialBalance
      if(initialBalance===undefined)throw new Error('请明确账户初始余额；没有余额请说0元')
      const value={name,type:type as Account['type'],initialBalance,color:current?.color||'#4F6EF7'}
      label=name;run=current?()=>s.updateAccount(current.id,value):()=>{s.addAccount(value)}
    }
  } else if(args.action==='list_notes') {
    const rows=s.notes.filter(item=>!args.query||item.content.includes(args.query)||item.id===args.query)
    return {text:rows.length?rows.slice(0,30).map(item=>`${item.content}［${item.id}］`).join('\n\n'):'没有对应笔记',modelStatus:'笔记查询结果仅在本机显示，未发给模型'}
  } else if(['add_note','update_note','delete_note'].includes(args.action)) {
    const current=args.action==='add_note'?null:one(s.notes,args.query,item=>item.content)
    if(args.action==='delete_note'){label=current!.content.slice(0,100);guard=JSON.stringify(current);run=()=>s.deleteNote(current!.id)}
    else {const content=text(args.content,'笔记内容',10000);label=content.slice(0,100);run=current?()=>s.updateNote(current.id,content):()=>{noteId=s.addNote(content)}}
  } else if(args.action==='add_transfer') {
    const from=account(args.fromAccount),to=account(args.toAccount)
    if(from.id===to.id)throw new Error('转出与转入不能是同一账户')
    const amount=money(args.amountCents),fee=args.feeCents===undefined?0:money(args.feeCents,true)
    const day=args.date?date(args.date):today
    label=`${from.name} → ${to.name} ${formatMoney(amount)}，手续费 ${formatMoney(fee)}`
    run=()=>s.addTransfer({fromAccountId:from.id,toAccountId:to.id,amount,fee,datetime:new Date(`${day}T${args.time?time(args.time):'12:00'}:00`).getTime(),note:args.note})
  }
  if(!run)throw new Error('没有收到可执行操作')
  if(guard) {
    if(!approval)return {text:`请确认删除：${label}`,modelStatus:'等待用户在手机确认删除，尚未执行',pending:{args,guard,label}}
    if(approval.guard!==guard||JSON.stringify(approval.args)!==JSON.stringify(args))throw new Error('内容已经变化，请重新发起删除；未删除任何内容')
  }
  run();await flushPrivateStorage()
  let calendarText=''
  if(calendar) {
    if(!isCalendarSyncEnabled())calendarText='；尚未开启系统日历同步'
    else try{const latest=useStore.getState();await syncTasksToCalendar(latest.tasks,latest.records);calendarText=untimedTask?'；补充具体时间后写入系统日历':'；已同步系统日历'}catch{calendarText='；日历同步暂未成功，请检查日历权限'}
  }
  return {text:`${args.action.startsWith('delete_')?'已删除':args.action==='complete_task'?'已完成':args.action==='reopen_task'?'已恢复待办':'已保存'}：${label}${calendarText}`,modelStatus:'操作已在本机保存'+(calendar?`：${label}`:'')+(calendarText?'，日历状态已向用户显示':'')+(noteId?`，刚新增的笔记编号：${noteId}`:'')}
}
