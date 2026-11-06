import { TextArea, TextInput } from '@/components/common/TextField'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { showToast } from '@/components/common/Toast'
import { chatWithAgent, clearAgentHistory, readAgentConfig, readAgentHistory, saveAgentConfig, saveAgentHistory, testAgent, type AgentConfig, type AgentHistory } from '@/services/agent'
import { DailyCoachCard } from '@/components/DailyCoachCard'
import { useStore } from '@/store'
import { focusNotification, readCoachFocus } from '@/services/coach'
import { fmtDate } from '@/utils/date'
import { CoachSettings } from '@/components/CoachSettings'
import { executeWorkbench, saveAgentTasks, type AgentResult, type PendingAgentAction } from '@/services/agentActions'
import { HoldGesture } from '@/services/holdGesture'
import { HoldToTalk, NativeSpeech, type VoicePhase } from '@/services/voice'

const PRESETS=[
  {name:'DeepSeek',url:'https://api.deepseek.com',model:'deepseek-flash'},
  {name:'豆包／火山方舟',url:'https://ark.cn-beijing.volces.com/api/v3',model:''},
  {name:'OpenAI',url:'https://api.openai.com/v1',model:''},
  {name:'自定义',url:'',model:''},
]
export function AgentScreen({quickChatRequest=0,compact=false}:{quickChatRequest?:number;compact?:boolean}) {
  const [config,setConfig]=useState<AgentConfig>(()=>readAgentConfig()||{url:PRESETS[0].url,key:'',model:PRESETS[0].model})
  const [history,setHistory]=useState<AgentHistory>(readAgentHistory)
  const assistantName=useStore(s=>s.settings.assistantName)||'自律助手'
  const updateSettings=useStore(s=>s.updateSettings)
  const categories=useStore(s=>s.categories)
  const [nameOpen,setNameOpen]=useState(false),[nameDraft,setNameDraft]=useState('')
  const [batchId,setBatchId]=useState<string|null>(null)
  const [choices,setChoices]=useState<Record<string,string>>({})
  const batch=history.entries.find(entry=>entry.id===batchId)
  const drafts=batch?.results?.filter(result=>result.draft)||[]
  const saves=useRef(false)
  const [open,setOpen]=useState(()=>!readAgentConfig())
  const [busy,setBusy]=useState(false),[testing,setTesting]=useState(false)
  const [input,setInput]=useState(''),[showKey,setShowKey]=useState(false),[error,setError]=useState('')
  const [settingsError,setSettingsError]=useState('')
  const [voiceMode,setVoiceMode]=useState(false),[voicePhase,setVoicePhase]=useState<VoicePhase>('idle'),[cancelVoice,setCancelVoice]=useState(false)
  const voiceSend=useRef<(text:string)=>void>(()=>{})
  const gesture=useRef<HoldGesture|null>(null)
  const voice=useRef<HoldToTalk|null>(null)
  if(!voice.current)voice.current=new HoldToTalk(NativeSpeech,{phase:setVoicePhase,text:text=>voiceSend.current(text),error:setError})
  const voiceActive=voicePhase!=='idle'
  const beginVoice=useRef(()=>{});beginVoice.current=startVoice
  if(!gesture.current)gesture.current=new HoldGesture({start:()=>beginVoice.current(),release:()=>voice.current?.release(),cancel:()=>voice.current?.cancel(),changed:setCancelVoice,interrupted:()=>setError('外屏触控中断，本条语音未发送。请重新按住说话。')})
  useEffect(()=>{if(quickChatRequest)setVoiceMode(true)},[quickChatRequest])
  const bottom=useRef<HTMLDivElement>(null)
  useEffect(()=>{bottom.current?.scrollIntoView({block:'end'})},[history,busy])
  useEffect(()=>{
    const refresh=()=>{if(!busy)setHistory(readAgentHistory())}
    window.addEventListener('agent-history-saved',refresh)
    return ()=>window.removeEventListener('agent-history-saved',refresh)
  },[busy])
  const compactRef=useRef(compact);compactRef.current=compact
  useEffect(()=>{
    const cancel=()=>{gesture.current?.cancel();setCancelVoice(false);voice.current?.cancel()}
    const hidden=()=>{if(document.visibilityState!=='visible')cancel()}
    // Keyboard/permission windows can briefly blur the WebView. Native onPause
    // and visibilitychange still cancel when the app actually leaves the foreground.
    document.addEventListener('visibilitychange',hidden)
    const up=(e:PointerEvent)=>{if(e.pointerType!=='touch')gesture.current?.end(e.pointerId)}
    const cancelled=(e:PointerEvent)=>{if(e.pointerType!=='touch')gesture.current?.end(e.pointerId,true)}
    const move=(e:TouchEvent)=>{for(const t of Array.from(e.changedTouches))gesture.current?.move(t.identifier,t.clientY)}
    const end=(e:TouchEvent)=>{
      for(const t of Array.from(e.changedTouches)){
        if(e.type==='touchcancel'&&compactRef.current)gesture.current?.interrupt(t.identifier)
        else gesture.current?.end(t.identifier,e.type==='touchcancel')
      }
    }
    window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancelled)
    window.addEventListener('touchmove',move);window.addEventListener('touchend',end);window.addEventListener('touchcancel',end)
    return ()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancelled);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',end);window.removeEventListener('touchcancel',end);cancel()}
  },[])
  async function send(message=input,fromVoice=false) {
    if(!message.trim()||busy||batchId)return
    const saved=readAgentConfig();if(!saved){setOpen(true);return}
    setBusy(true);setError('');if(!fromVoice)setInput('')
    try {
      const next=await chatWithAgent(saved,history,message)
      const entry=next.entries[next.entries.length-1]
      const proposals=entry?.results?.filter(result=>result.draft)||[]
      setHistory(next)
      if(entry&&proposals.length){
        setChoices({})
        setBatchId(entry.id)
      }
    }
    catch(e){if(fromVoice){setInput(previous=>previous?previous+'\n'+message:message);setVoiceMode(false)}else setInput(message);setError(e instanceof Error?e.message:'AI 请求失败')}
    finally{setBusy(false)}
  }
  voiceSend.current=text=>void send(text,true)
  function startVoice() {
    if(busy||testing||open||voiceActive||batchId||nameOpen)return
    if(!readAgentConfig()){setOpen(true);return}
    setError('');setCancelVoice(false);void voice.current?.press()
  }
  async function finishDrafts(save:boolean) {
    if(!batch||!drafts.length||saves.current)return
    saves.current=true;setBusy(true);setError('')
    try {
      const cancelled={text:'已取消，草稿未保存',modelStatus:'用户取消新增事项'}
      const outcomes=save?await saveAgentTasks(drafts.map(({draft})=>({draft:draft!,categoryId:choices[draft!.task.id]}))):drafts.map(()=>cancelled)
      if(save&&drafts.length===1){
        const {task,record}=drafts[0].draft!
        focusNotification(task.id,record?.date||task.scheduledDate||fmtDate(new Date()))
      }
      const replacements=new Map<string,AgentResult>()
      drafts.forEach(({callId,draft},i)=>{
        if(callId)replacements.set(callId,outcomes[i])
        if(draft!.note?.callId)replacements.set(draft!.note.callId,{text:save?'已删除指定原笔记':'原笔记保留',modelStatus:save?'已删除指定原笔记':'未删除原笔记'})
        if(draft!.completionCallId)replacements.set(draft!.completionCallId,{text:save?'已标记完成':'未标记完成',modelStatus:save?'操作已在本机保存，已标记完成':'未标记完成'})
      })
      const next={...history,messages:history.messages.map(message=>{
        const result=message.tool_call_id&&replacements.get(message.tool_call_id)
        return message.role==='tool'&&result?{...message,content:JSON.stringify({status:result.modelStatus})}:message
      }),entries:history.entries.map(entry=>entry.id===batch.id?{...entry,results:entry.results?.map(old=>{
        const replacement=old.callId&&replacements.get(old.callId)
        return replacement?{...replacement,callId:old.callId}:old
      })}:entry)}
      setHistory(next);setBatchId(null)
      await saveAgentHistory(next)
    } catch(e){setError(e instanceof Error?e.message:'事项保存失败，请重试')}
    finally{saves.current=false;setBusy(false)}
  }
  async function confirmDelete(entryId:string,index:number,pending:PendingAgentAction) {
    setBusy(true);setError('')
    try {
      const result=await executeWorkbench(pending.args,pending)
      const callId=history.entries.find(entry=>entry.id===entryId)?.results?.[index].callId
      const next={...history,messages:history.messages.map(message=>message.role==='tool'&&message.tool_call_id===callId?{...message,content:JSON.stringify({status:result.modelStatus})}:message),entries:history.entries.map(entry=>entry.id===entryId?{...entry,results:entry.results?.map((old,i)=>i===index?{...result,callId}:old)}:entry)}
      await saveAgentHistory(next);setHistory(next)
    } catch(e){setError(e instanceof Error?e.message:'删除失败')}
    finally{setBusy(false)}
  }
  async function cancelDelete(entryId:string,index:number) {
    const callId=history.entries.find(entry=>entry.id===entryId)?.results?.[index].callId
    const next={...history,messages:history.messages.map(message=>message.role==='tool'&&message.tool_call_id===callId?{...message,content:JSON.stringify({status:'用户取消删除'})}:message),entries:history.entries.map(entry=>entry.id===entryId?{...entry,results:entry.results?.map((old,i)=>i===index?{text:'已取消删除，本机内容保留',modelStatus:'用户取消删除',callId}:old)}:entry)}
    await saveAgentHistory(next);setHistory(next)
  }
  return <div className={"agent-screen flex flex-col min-h-0 h-full "+(compact?"agent-compact":"")}>
    <header className="agent-header px-4 pt-3 pb-3 flex flex-wrap gap-2 items-center justify-between shrink-0">
      <h1 className="agent-name text-xl font-medium text-gray-900 min-w-0"><button type="button" title="修改助手名字" aria-label={`${assistantName}，修改助手名字`} disabled={busy||voiceActive} onClick={()=>{setNameDraft(assistantName==='自律助手'?'':assistantName);setNameOpen(true)}}>{assistantName} <span aria-hidden="true" className="text-primary text-xs">✎</span></button></h1>
      <div className="flex items-center gap-2 text-xs">
        <CoachSettings disabled={busy||voiceActive}/>
        <button disabled={busy||testing||voiceActive} onClick={async()=>{await clearAgentHistory();setHistory({messages:[],entries:[]});setError('')}} className="agent-clear text-gray-500 disabled:opacity-40">{compact?'清空':'清空对话'}</button>
        <button disabled={busy||voiceActive} onClick={()=>{setConfig(readAgentConfig()||config);setOpen(true)}} className="text-primary disabled:opacity-40">API 设置</button>
      </div>
    </header>
    {readCoachFocus()&&<p className="px-4 pb-2 text-xs text-primary break-words">正在聊：{readCoachFocus()!.title} · {readCoachFocus()!.date}</p>}
    <DailyCoachCard onDiscuss={()=>bottom.current?.scrollIntoView({block:'end'})}/>
    <div className="agent-messages flex-1 min-h-0 overflow-y-auto px-4 pb-3 space-y-3">
      {!history.entries.length&&<div className="bg-white rounded-2xl p-4 text-sm text-gray-600 space-y-3">
        <p>告诉我你的目标，或者直接交代今天要做的事。我会和你确定计划，记住你的承诺，认真跟进。</p>
        <p>例如：“这个月想读完一本书，帮我拟个计划”“请记住，我想减少睡前刷手机”“把刚才那件事挪到明天”。日程、记账、账户和笔记也能继续处理。</p>
        <p className="text-xs text-gray-400">你发送的对话及匹配所需的待办标题、日期和状态交给所选 API 服务处理，不包含任务备注。查账、余额和笔记检索结果只在本机显示，不发给模型。删除需要点击确认。点击输入区的“语音”可按住说话、松开发送。</p>
      </div>}
      {history.entries.map(entry=><div key={entry.id} className={`flex ${entry.role==='user'?'justify-end':'justify-start'}`}>
        <div className={`max-w-full min-w-0 rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words ${entry.role==='user'?'bg-primary text-white ml-8':'bg-white text-gray-800 mr-2'}`}>
          {entry.text&&<p>{entry.text}</p>}
          {entry.results?.map((result,i)=><div key={i} className={i?'border-t border-gray-100 mt-3 pt-3':''}>
            {entry.text&&result.modelStatus.startsWith("操作已在本机保存")&&!result.pending?<details className="mt-2 text-xs text-gray-500"><summary className="cursor-pointer text-primary">已保存 · 查看详情</summary><p className="mt-2">{result.text}</p></details>:<p>{result.text}</p>}
            {result.draft&&<button type="button" className="mt-2 text-primary" onClick={()=>{setChoices({});setBatchId(entry.id)}}>选择分类并保存</button>}
            {result.pending&&<div className="flex gap-3 mt-3">
              <button disabled={busy||voiceActive} onClick={()=>void cancelDelete(entry.id,i)} className="px-3 py-2 rounded-xl bg-gray-100 disabled:opacity-40">取消</button>
              <button disabled={busy||voiceActive} onClick={()=>void confirmDelete(entry.id,i,result.pending!)} className="px-3 py-2 rounded-xl bg-red-500 text-white disabled:opacity-40">确认删除</button>
            </div>}
          </div>)}
        </div>
      </div>)}
      {busy&&<p className="text-sm text-gray-400" role="status">正在处理，请稍候…</p>}
      {error&&<p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl" role="alert">{error}</p>}
      <div ref={bottom}/>
    </div>
    <form onSubmit={e=>{e.preventDefault();if(!voiceActive)void send()}} className="agent-composer shrink-0 px-3 py-3 bg-white border-t border-gray-100">
      <div className="flex items-end gap-2">
        <button type="button" aria-label={voiceMode?'切换到文字输入':'切换到语音输入'} disabled={busy||voiceActive} onClick={()=>setVoiceMode(!voiceMode)} className="w-11 h-12 shrink-0 rounded-xl bg-gray-100 text-sm text-gray-600 disabled:opacity-40">{voiceMode?'文字':'语音'}</button>
        {voiceMode?<button type="button" disabled={busy||voicePhase==='finishing'} aria-label="按住说话" aria-pressed={voicePhase==='listening'}
          className={`voice-hold flex-1 min-w-0 h-16 px-2 py-2 rounded-2xl border text-base font-medium select-none disabled:opacity-40 ${cancelVoice?'bg-red-500 text-white border-red-500':voiceActive?'bg-primary text-white border-primary':'bg-gray-100 text-gray-700 border-gray-200'}`}
          style={{touchAction:'none'}} onContextMenu={e=>e.preventDefault()}
          onTouchStart={e=>{if(busy||!compact&&voiceActive||e.touches.length!==1)return;const t=e.changedTouches[0];if(t)gesture.current?.begin(t.identifier,t.clientY,t.clientX)}}
          onPointerDown={e=>{if(e.pointerType==='touch'||!e.isPrimary||e.button!==0||busy||voiceActive)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);gesture.current?.begin(e.pointerId,e.clientY,e.clientX)}}
          onPointerMove={e=>{if(e.pointerType!=='touch')gesture.current?.move(e.pointerId,e.clientY)}}
          onKeyDown={e=>{if(e.key==='Escape'){gesture.current?.cancel();voice.current?.cancel();return}if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();startVoice()}}}
          onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();voice.current?.release()}}}
        >{cancelVoice?'松开取消':voicePhase==='preparing'?'准备中，继续按住':voicePhase==='listening'?'松开发送':voicePhase==='finishing'?'正在识别…':voicePhase==='ready'?'松开发送':'按住说话'}</button>:<>
          <TextArea aria-label="给 AI 助手发消息" value={input} disabled={busy||voiceActive} onChange={e=>setInput(e.target.value)} rows={2} maxLength={4000} placeholder="说说要安排或记录的事情…" className="flex-1 min-w-0 resize-none bg-gray-100 rounded-xl px-3 py-2 text-base outline-none"/>
          <button disabled={busy||voiceActive||!input.trim()} type="submit" className="px-4 py-3 bg-primary rounded-xl text-white text-sm disabled:opacity-40">发送</button>
        </>}
      </div>
      {voiceMode&&!compact&&<p className="mt-2 text-[10px] text-gray-400">单次最长60秒。系统语音识别可能联网；识别文字自动发给当前 AI，应用不保存录音。首次允许麦克风后，请重新按住说话。</p>}
    </form>
    <Modal open={nameOpen} onClose={()=>setNameOpen(false)} title="给助手起个名字">
      <form className="space-y-3" onSubmit={e=>{
        e.preventDefault()
        const name=String(new FormData(e.currentTarget).get('assistantName')||'').trim()
        updateSettings({assistantName:name||undefined})
        setNameOpen(false)
        showToast(name?`助手已改名为${name}`:'已恢复默认名称')
      }}>
        <label className="block text-sm">助手名字<TextInput name="assistantName" value={nameDraft} onChange={e=>setNameDraft(e.target.value)} maxLength={20} placeholder="例如球球，留空恢复默认名称" className="block w-full mt-2 p-3 rounded-xl border text-base"/></label>
        <button className="w-full rounded-xl bg-primary text-white p-3">保存名字</button>
      </form>
    </Modal>
    <Modal open={!!batch&&drafts.length>0} onClose={()=>{if(!busy)void finishDrafts(false)}} title={`确认 ${drafts.length} 项新事项`} footer={
      <div className="flex gap-2">
          <button disabled={busy} onClick={()=>void finishDrafts(false)} className="rounded-xl px-3 py-2.5 bg-gray-100 text-sm">取消</button>
          <button disabled={busy||!drafts.every(({draft})=>categories.some(category=>category.id===choices[draft!.task.id]))} onClick={()=>void finishDrafts(true)} className="flex-1 rounded-xl px-2 py-2.5 bg-primary text-sm whitespace-nowrap text-white disabled:opacity-40">{busy?'保存中…':drafts.some(({draft})=>draft?.note)?'保存并删除原笔记':'一起保存'}</button>
        </div>
    }>
      <div className="space-y-3">
        {drafts.map(({draft})=>{
          const {task,label,record,note}=draft!
          const suggestion=categories.find(category=>category.id===task.categoryId)
          return <section key={task.id} className="rounded-xl border border-gray-100 p-3 space-y-2">
            <h3 className="font-semibold break-words">{task.title}</h3>
            <p className="text-xs text-gray-600 break-words">{label.slice(task.title.length+3)}{task.scheduledTime&&task.duration?` · ${task.duration} 分钟`:''}{record&&<span className="whitespace-nowrap"> · 已完成</span>}</p>
            {record&&<p className="text-xs text-gray-600">实际完成 {new Date(record.completedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>}
            {suggestion&&<p className="text-xs text-gray-500">建议分类 · {suggestion.name}</p>}
            <div className="flex flex-wrap gap-2" role="group" aria-label={`${task.title}的分类`}>
              {categories.map(category=><button type="button" key={category.id} disabled={busy} aria-pressed={choices[task.id]===category.id} className={`inline-flex gap-1 items-center rounded-lg border px-2.5 py-1.5 text-xs ${choices[task.id]===category.id?'border-primary bg-primary/10 text-primary':'border-gray-200 text-gray-700'}`} onClick={()=>setChoices(prev=>({...prev,[task.id]:category.id}))}>{category.name}</button>)}
            </div>
            {note&&<p className="text-xs text-red-600 break-words">同时删除原笔记「{note.label}」</p>}
          </section>
        })}
        {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}

      </div>
    </Modal>
    <Modal open={open} onClose={()=>{if(!testing)setOpen(false)}} title="AI 服务设置">
      <form noValidate className="space-y-4" onSubmit={async e=>{
        e.preventDefault()
        if(testing)return
        const fields=new FormData(e.currentTarget)
        const candidate={url:String(fields.get('url')||'').trim(),key:String(fields.get('key')||'').trim(),model:String(fields.get('model')||'').trim()}
        setConfig(candidate);setSettingsError('');setTesting(true)
        try{await testAgent(candidate);await saveAgentConfig(candidate);setHistory(readAgentHistory());setOpen(false);showToast('AI 服务已连接，配置已加密保存')}
        catch(e){setSettingsError(e instanceof Error?e.message:'连接失败，请重试')}
        finally{setTesting(false)}
      }}>
        <p className="text-xs text-gray-500">使用你自己的开发者 API Key，费用或免费额度由服务商决定。密钥仅加密保存在这台手机，不随备份和设备同步导出。</p>
        <div className="flex gap-2 flex-wrap">{PRESETS.map(preset=><button type="button" key={preset.name} disabled={testing} onClick={()=>{setConfig({...config,url:preset.url,model:preset.model,key:''});setSettingsError('')}} className="rounded-full px-3 py-1.5 bg-gray-100 text-xs disabled:opacity-40">{preset.name}</button>)}</div>
        <label className="block text-sm">服务地址<TextInput name="url" value={config.url} disabled={testing} onChange={e=>setConfig({...config,url:e.target.value})} type="url" autoCapitalize="none" autoCorrect="off" placeholder="https://服务地址/v1" className="w-full mt-1 p-3 rounded-xl border text-base"/></label>
        <label className="block text-sm">API Key<TextInput name="key" value={config.key} disabled={testing} onChange={e=>setConfig({...config,key:e.target.value})} type={showKey?'text':'password'} autoComplete="off" autoCapitalize="none" autoCorrect="off" placeholder="只填在这里，不要发到对话里" className="w-full mt-1 p-3 rounded-xl border text-base"/></label>
        <button type="button" disabled={testing} onClick={()=>setShowKey(!showKey)} className="text-xs text-primary">{showKey?'隐藏密钥':'显示密钥'}</button>
        <label className="block text-sm">模型名／接入点 ID<TextInput name="model" value={config.model} disabled={testing} onChange={e=>setConfig({...config,model:e.target.value})} autoCapitalize="none" autoCorrect="off" placeholder="填写服务商控制台提供的模型名" className="w-full mt-1 p-3 rounded-xl border text-base"/></label>
        <p className="text-xs text-gray-400">支持 OpenAI 兼容的 Chat Completions 和工具调用。系统语音识别可能联网，应用不保存录音。切换服务地址或模型会清空旧对话，避免把旧对话自动发给另一家服务商。</p>
        {settingsError&&<p role="alert" className="text-sm text-red-600 bg-red-50 p-3 rounded-xl break-words">{settingsError}</p>}
        <button type="submit" disabled={testing} className="w-full rounded-xl bg-primary text-white p-3 disabled:opacity-40">{testing?'连接测试中…':'测试连接并保存'}</button>
      </form>
    </Modal>
  </div>
}
