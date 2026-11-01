import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { showToast } from '@/components/common/Toast'
import { chatWithAgent, clearAgentHistory, readAgentConfig, readAgentHistory, saveAgentConfig, saveAgentHistory, testAgent, type AgentConfig, type AgentHistory } from '@/services/agent'
import { executeWorkbench, type PendingAgentAction } from '@/services/agentActions'
import { HoldToTalk, NativeSpeech, type VoicePhase } from '@/services/voice'

const PRESETS=[
  {name:'DeepSeek',url:'https://api.deepseek.com',model:'deepseek-flash'},
  {name:'豆包／火山方舟',url:'https://ark.cn-beijing.volces.com/api/v3',model:''},
  {name:'OpenAI',url:'https://api.openai.com/v1',model:''},
  {name:'自定义',url:'',model:''},
]
export function AgentScreen({quickChatRequest=0}:{quickChatRequest?:number}) {
  const [config,setConfig]=useState<AgentConfig>(()=>readAgentConfig()||{url:PRESETS[0].url,key:'',model:PRESETS[0].model})
  const [history,setHistory]=useState<AgentHistory>(readAgentHistory)
  const [open,setOpen]=useState(()=>!readAgentConfig())
  const [busy,setBusy]=useState(false),[testing,setTesting]=useState(false)
  const [input,setInput]=useState(''),[showKey,setShowKey]=useState(false),[error,setError]=useState('')
  const [settingsError,setSettingsError]=useState('')
  const [voiceMode,setVoiceMode]=useState(false),[voicePhase,setVoicePhase]=useState<VoicePhase>('idle'),[cancelVoice,setCancelVoice]=useState(false)
  const voiceSend=useRef<(text:string)=>void>(()=>{})
  const pointer=useRef<{id:number;y:number;cancel:boolean}|null>(null)
  const voice=useRef<HoldToTalk|null>(null)
  if(!voice.current)voice.current=new HoldToTalk(NativeSpeech,{phase:setVoicePhase,text:text=>voiceSend.current(text),error:setError})
  const voiceActive=voicePhase!=='idle'
  useEffect(()=>{if(quickChatRequest)setVoiceMode(true)},[quickChatRequest])
  const bottom=useRef<HTMLDivElement>(null)
  useEffect(()=>{bottom.current?.scrollIntoView({block:'end'})},[history,busy])
  useEffect(()=>{
    const refresh=()=>{if(!busy)setHistory(readAgentHistory())}
    window.addEventListener('agent-history-saved',refresh)
    return ()=>window.removeEventListener('agent-history-saved',refresh)
  },[busy])
  useEffect(()=>{
    const cancel=()=>{pointer.current=null;setCancelVoice(false);voice.current?.cancel()}
    const hidden=()=>{if(document.visibilityState!=='visible')cancel()}
    window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden)
    return ()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);voice.current?.cancel()}
  },[])
  async function send(message=input,fromVoice=false) {
    if(!message.trim()||busy)return
    const saved=readAgentConfig();if(!saved){setOpen(true);return}
    setBusy(true);setError('');if(!fromVoice)setInput('')
    try{setHistory(await chatWithAgent(saved,history,message))}
    catch(e){if(fromVoice){setInput(previous=>previous?previous+'\n'+message:message);setVoiceMode(false)}else setInput(message);setError(e instanceof Error?e.message:'AI 请求失败')}
    finally{setBusy(false)}
  }
  voiceSend.current=text=>void send(text,true)
  function startVoice() {
    if(busy||testing||open||voiceActive)return
    if(!readAgentConfig()){setOpen(true);return}
    setError('');setCancelVoice(false);void voice.current?.press()
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
  return <div className="flex flex-col h-full">
    <header className="px-4 pt-3 pb-3 flex items-center justify-between shrink-0">
      <h1 className="text-2xl font-light text-gray-900">AI 助手</h1>
      <div className="flex items-center gap-3 text-sm">
        <button disabled={busy||testing||voiceActive} onClick={async()=>{await clearAgentHistory();setHistory({messages:[],entries:[]});setError('')}} className="text-gray-500 disabled:opacity-40">清空对话</button>
        <button disabled={busy||voiceActive} onClick={()=>{setConfig(readAgentConfig()||config);setOpen(true)}} className="text-primary disabled:opacity-40">API 设置</button>
      </div>
    </header>
    <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
      {!history.entries.length&&<div className="bg-white rounded-2xl p-4 text-sm text-gray-600 space-y-3">
        <p>直接说你想做什么，日程、记账、账户和笔记都可以在这里处理。</p>
        <p>例如：“明天下午五点整理测试资料”“微信支出午饭30元”“查询本月支出”“记一条笔记”。</p>
        <p className="text-xs text-gray-400">你发送的对话交给所选 API 服务处理。查账、余额和笔记检索结果只在本机显示，不发给模型。删除需要点击确认。点击输入区的“语音”可按住说话、松开发送。</p>
      </div>}
      {history.entries.map(entry=><div key={entry.id} className={`flex ${entry.role==='user'?'justify-end':'justify-start'}`}>
        <div className={`max-w-full min-w-0 rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words ${entry.role==='user'?'bg-primary text-white ml-8':'bg-white text-gray-800 mr-2'}`}>
          {entry.text&&<p>{entry.text}</p>}
          {entry.results?.map((result,i)=><div key={i} className={i?'border-t border-gray-100 mt-3 pt-3':''}>
            <p>{result.text}</p>
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
    <form onSubmit={e=>{e.preventDefault();if(!voiceActive)void send()}} className="shrink-0 px-3 py-3 bg-white border-t border-gray-100">
      <div className="flex items-end gap-2">
        <button type="button" aria-label={voiceMode?'切换到文字输入':'切换到语音输入'} disabled={busy||voiceActive} onClick={()=>setVoiceMode(!voiceMode)} className="w-11 h-12 shrink-0 rounded-xl bg-gray-100 text-sm text-gray-600 disabled:opacity-40">{voiceMode?'文字':'语音'}</button>
        {voiceMode?<button type="button" disabled={busy||voicePhase==='finishing'} aria-label="按住说话" aria-pressed={voicePhase==='listening'}
          className={`flex-1 min-w-0 h-12 rounded-xl border text-sm font-medium select-none disabled:opacity-40 ${cancelVoice?'bg-red-500 text-white border-red-500':voiceActive?'bg-primary text-white border-primary':'bg-gray-100 text-gray-700 border-gray-200'}`}
          style={{touchAction:'none'}} onContextMenu={e=>e.preventDefault()}
          onPointerDown={e=>{if(e.button!==0||busy||voiceActive)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointer.current={id:e.pointerId,y:e.clientY,cancel:false};startVoice()}}
          onPointerMove={e=>{if(pointer.current?.id!==e.pointerId)return;const cancel=e.clientY<pointer.current.y-60;pointer.current.cancel=cancel;setCancelVoice(cancel)}}
          onPointerUp={e=>{if(pointer.current?.id!==e.pointerId)return;const cancel=pointer.current.cancel;pointer.current=null;setCancelVoice(false);if(cancel)voice.current?.cancel();else voice.current?.release()}}
          onPointerCancel={()=>{pointer.current=null;setCancelVoice(false);voice.current?.cancel()}}
          onLostPointerCapture={()=>{if(pointer.current){pointer.current=null;setCancelVoice(false);voice.current?.cancel()}}}
          onKeyDown={e=>{if(e.key==='Escape'){voice.current?.cancel();return}if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();startVoice()}}}
          onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();voice.current?.release()}}}
        >{cancelVoice?'松开取消':voicePhase==='preparing'?'正在准备…':voicePhase==='listening'?'松开发送，上滑取消':voicePhase==='finishing'?'正在识别…':voicePhase==='ready'?'录音已结束，松开发送':'按住说话'}</button>:<>
          <textarea aria-label="给 AI 助手发消息" value={input} disabled={busy||voiceActive} onChange={e=>setInput(e.target.value)} rows={2} maxLength={4000} placeholder="说说要安排或记录的事情…" className="flex-1 min-w-0 resize-none bg-gray-100 rounded-xl px-3 py-2 text-base outline-none"/>
          <button disabled={busy||voiceActive||!input.trim()} type="submit" className="px-4 py-3 bg-primary rounded-xl text-white text-sm disabled:opacity-40">发送</button>
        </>}
      </div>
      {voiceMode&&<p className="mt-2 text-[10px] text-gray-400">单次最长60秒。系统语音识别可能联网；识别文字自动发给当前 AI，应用不保存录音。首次允许麦克风后，请重新按住说话。</p>}
    </form>
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
        <label className="block text-sm">服务地址<input name="url" value={config.url} disabled={testing} onChange={e=>setConfig({...config,url:e.target.value})} type="url" autoCapitalize="none" autoCorrect="off" placeholder="https://服务地址/v1" className="w-full mt-1 p-3 rounded-xl border text-base"/></label>
        <label className="block text-sm">API Key<input name="key" value={config.key} disabled={testing} onChange={e=>setConfig({...config,key:e.target.value})} type={showKey?'text':'password'} autoComplete="off" autoCapitalize="none" autoCorrect="off" placeholder="只填在这里，不要发到对话里" className="w-full mt-1 p-3 rounded-xl border text-base"/></label>
        <button type="button" disabled={testing} onClick={()=>setShowKey(!showKey)} className="text-xs text-primary">{showKey?'隐藏密钥':'显示密钥'}</button>
        <label className="block text-sm">模型名／接入点 ID<input name="model" value={config.model} disabled={testing} onChange={e=>setConfig({...config,model:e.target.value})} autoCapitalize="none" autoCorrect="off" placeholder="填写服务商控制台提供的模型名" className="w-full mt-1 p-3 rounded-xl border text-base"/></label>
        <p className="text-xs text-gray-400">支持 OpenAI 兼容的 Chat Completions 和工具调用。切换服务地址或模型会清空旧对话，避免把旧对话自动发给另一家服务商。</p>
        {settingsError&&<p role="alert" className="text-sm text-red-600 bg-red-50 p-3 rounded-xl break-words">{settingsError}</p>}
        <button type="submit" disabled={testing} className="w-full rounded-xl bg-primary text-white p-3 disabled:opacity-40">{testing?'连接测试中…':'测试连接并保存'}</button>
      </form>
    </Modal>
  </div>
}
