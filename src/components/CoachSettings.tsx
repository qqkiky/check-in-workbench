import { useState } from 'react'
import { readDailyConfig, saveDailyConfig, dailyStatus, refreshDaily } from '@/services/coachDaily'
import { Modal } from './common/Modal'
import { TextArea } from './common/TextField'
import { showToast } from './common/Toast'
import { readMemories, saveMemory, deleteMemory, readProposals, acceptProposal, dismissProposal, type CoachMemory } from '@/services/coach'
import { testCoachNotification, readCoachReminders, reminderStatus, requestCoachPermission, saveCoachReminders, openExactReminderSettings } from '@/services/coachReminders'

export function CoachSettings({disabled=false}:{disabled?:boolean}) {
 const [open,setOpen]=useState(false),[revision,refresh]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [draft,setDraft]=useState<{id?:string;kind:CoachMemory['kind'];content:string}>({kind:'goal',content:''})
 const [daily,setDaily]=useState(readDailyConfig)
 const [reminders,setReminders]=useState(readCoachReminders),[status,setStatus]=useState({granted:false,exact:false})
 const update=()=>refresh(value=>value+1)
 async function act(run:()=>Promise<unknown>){setBusy(true);setError('');try{await run();update()}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}
 const memories=readMemories(),proposals=readProposals();void revision
 return <>
  <button disabled={disabled} onClick={()=>{setDaily(readDailyConfig());void refreshDaily().then(update);setReminders(readCoachReminders());void reminderStatus().then(setStatus).catch(()=>{});setOpen(true);update()}} className="text-sm text-primary disabled:opacity-40">了解我</button>
  <Modal open={open} onClose={()=>{if(!busy)setOpen(false)}} title="了解我 · 自律教练">
   <div className="space-y-5 text-sm">
    <p className="text-xs text-gray-500">认真督促，按真实完成状态跟进。已确认记忆加密保存在手机；对话时按需提供给你设置的 API。记忆可随手动备份导出，暂不参与跨设备同步。目标跟进也保存在手机。</p>
    {proposals.length>0&&<section className="space-y-3"><h2 className="font-semibold">等你确认</h2>{proposals.map(p=><div key={p.id} className="p-3 rounded-xl bg-indigo-50 space-y-2"><p className="font-medium break-words">{p.title}</p>{p.items?.map((item,i)=><p key={i} className="text-xs text-gray-600">{item.date||'日期未定'} {item.time||'时间未定'} · {item.title}{item.recurrence&&item.recurrence!=='none'?' · '+({daily:'每天',weekly:'每周 '+item.weekdays?.map(d=>['日','一','二','三','四','五','六'][d]).join('、'),monthly:'每月'+item.monthDay+'日'}[item.recurrence]):''}</p>)}{p.goals?.map(g=><div key={g.id} className="text-xs text-gray-600 break-words"><p>{g.title} · {g.deadline||'截止日期待明确'}</p>{g.progress&&<p>进度：{g.progress}</p>}<p>关联现有事项 {g.taskIds.length} 项</p></div>)}<div className="flex gap-3"><button disabled={busy} onClick={()=>void act(async()=>showToast(await acceptProposal(p.id)))} className="bg-primary text-white rounded-lg px-3 py-2">{p.kind==='memory'?'确认记住':p.kind==='goals'?'采纳目标整理':'采纳计划'}</button><button disabled={busy} onClick={()=>void act(()=>dismissProposal(p.id))} className="text-gray-500">暂不采纳</button></div></div>)}</section>}
    <section className="space-y-3"><h2 className="font-semibold">我记住的事 · {memories.length}</h2>
     {!memories.length&&<p className="text-gray-400 text-xs">写下目标、作息或偏好，也可以在聊天中说“请记住……”。AI 的提案需要你确认。</p>}
     {memories.map(row=><div key={row.id} className="rounded-xl border p-3"><span className="text-xs text-primary">{{goal:'目标',routine:'作息',preference:'偏好'}[row.kind]}</span><p className="whitespace-pre-wrap break-words mt-1">{row.content}</p><div className="flex gap-4 text-xs mt-2"><button disabled={busy} onClick={()=>setDraft(row)} className="text-primary">修改</button><button disabled={busy} onClick={()=>void act(async()=>{await deleteMemory(row.id);if(draft.id===row.id)setDraft({kind:'goal',content:''})})} className="text-red-500">删除</button></div></div>)}
     <form className="space-y-2" onSubmit={e=>{e.preventDefault();void act(async()=>{await saveMemory(draft);setDraft({kind:'goal',content:''})})}}>
      <div className="flex gap-2">{(['goal','routine','preference'] as const).map(kind=><button type="button" disabled={busy} key={kind} onClick={()=>setDraft({...draft,kind})} className={'px-3 py-2 rounded-lg '+(draft.kind===kind?'bg-primary text-white':'bg-gray-100')}>{{goal:'目标',routine:'作息',preference:'偏好'}[kind]}</button>)}</div>
      <TextArea aria-label="长期记忆内容" value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})} maxLength={500} rows={3} placeholder="例如：我想每天睡前阅读，减少刷手机。" className="w-full border rounded-xl p-3 text-base"/>
      <div className="flex gap-3"><button disabled={busy||!draft.content.trim()} className="px-3 py-2 rounded-lg bg-primary text-white disabled:opacity-40">{draft.id?'保存修改':'添加记忆'}</button>{draft.id&&<button type="button" onClick={()=>setDraft({kind:'goal',content:''})}>取消修改</button>}</div>
     </form>
     <p className="text-xs text-gray-400">删除记忆不会删除原聊天。需要移除原对话时，可在助手顶部清空对话。</p>
    </section>
    <section className="space-y-3 border-t pt-4"><h2 className="font-semibold">早晚 AI 目标跟进</h2>
     <p className="text-xs text-gray-500">早上梳理行动，晚上根据真实打卡复盘。每天最多两次自动调用你设置的 API，可能产生服务商费用；仅发送已确认目标、作息偏好、待办标题和打卡日期，不发送账本、笔记或任务备注。后台省电和网络可能延迟。</p>
     <label className="flex items-center gap-2"><input type="checkbox" checked={daily.enabled} onChange={e=>setDaily({...daily,enabled:e.target.checked})}/>开启早晚跟进</label>
     <div className="flex flex-wrap gap-3"><label>早间 <input aria-label="早间跟进时间" type="time" value={daily.morning} onChange={e=>setDaily({...daily,morning:e.target.value})} className="border rounded-lg p-2"/></label><label>晚间 <input aria-label="晚间跟进时间" type="time" value={daily.evening} onChange={e=>setDaily({...daily,evening:e.target.value})} className="border rounded-lg p-2"/></label></div>
     <button disabled={busy} onClick={()=>void act(async()=>{await saveDailyConfig(daily);showToast('早晚跟进设置已保存')})} className="text-primary">保存早晚设置</button>
     <p className="text-xs text-gray-400">今天已发起 {dailyStatus().used}/2 次。请求前记录额度；失败也不自动重复调用。关闭不影响普通任务提醒。AI 建议须采纳才会写入目标或计划。</p>
    </section>
    <section className="space-y-3 border-t pt-4"><h2 className="font-semibold">手机与手环督促</h2>
     <p className="text-xs text-gray-500">督促所有有具体时间的未完成事项，最多跟进4小时。通知不请求 AI；完成或改期后停止旧催办。</p>
     <label className="block">跟进间隔<select aria-label="跟进间隔" value={reminders.interval} onChange={e=>setReminders({...reminders,interval:Number(e.target.value)})} className="ml-3 border rounded-lg p-2">{[15,30,60].map(n=><option key={n} value={n}>{n} 分钟</option>)}</select></label>
     <div className="flex flex-wrap items-center gap-2"><span>休息时段</span><input aria-label="免打扰开始" type="time" value={reminders.quietStart} onChange={e=>setReminders({...reminders,quietStart:e.target.value})} className="border rounded-lg p-2"/><span>至</span><input aria-label="免打扰结束" type="time" value={reminders.quietEnd} onChange={e=>setReminders({...reminders,quietEnd:e.target.value})} className="border rounded-lg p-2"/></div>
     <button disabled={busy} onClick={()=>void act(async()=>{const next={...reminders,enabled:!reminders.enabled};if(next.enabled){const result=await requestCoachPermission();setStatus(result);if(!result.granted)throw new Error('需要在手机设置中允许期待发送通知')}await saveCoachReminders(next);setReminders(next);showToast(next.enabled?'本地督促已开启':'本地督促已关闭')})} className="rounded-xl bg-primary text-white px-4 py-3">{reminders.enabled?'关闭主动督促':'允许通知并开启督促'}</button>
     {reminders.enabled&&<button disabled={busy} onClick={()=>void act(async()=>{await saveCoachReminders(reminders);showToast('督促设置已保存')})} className="ml-3 text-primary">保存设置</button>}
     {reminders.enabled&&<button disabled={busy} onClick={()=>void act(async()=>{await testCoachNotification();showToast("测试通知已发送，请检查手机和手环")})} className="block text-primary text-xs">测试手机／手环通知</button>}
     {reminders.enabled&&!status.exact&&<button onClick={()=>void openExactReminderSettings()} className="block text-primary text-xs">允许准时提醒（当前可能延迟）</button>}
     <p className="text-xs text-gray-500">小米运动健康 → 手环9 Pro → 通知与来电 → App通知中允许“期待”，并保持手环连接。手机省电或强制停止仍可能延迟提醒。</p>
    </section>
    {error&&<p role="alert" className="text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
   </div>
  </Modal>
 </>
}
