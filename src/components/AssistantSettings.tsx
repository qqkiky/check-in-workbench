import { useState } from 'react'
import { readAssistantConfig, saveAssistantConfig, syncAssistant } from '@/services/assistant'
import { Modal } from './common/Modal'
import { showToast } from './common/Toast'

export function AssistantSettings() {
  const [open,setOpen]=useState(false)
  const [url,setUrl]=useState(()=>readAssistantConfig()?.url || '')
  const [token,setToken]=useState(()=>readAssistantConfig()?.token || '')
  const [enabled,setEnabled]=useState(()=>!!readAssistantConfig()?.enabled)
  const [busy,setBusy]=useState(false)
  async function connect(){
    setBusy(true)
    try {
      await saveAssistantConfig({url,token,enabled:true})
      setEnabled(true)
      const result=await syncAssistant()
      showToast(`已同步 ${result.count} 项日程${result.deliveryError ? '；微信发送受限，请与助手互动后重试' : result.connected ? '' : '；微信尚未扫码连接'}`)
    }catch(error){showToast(error instanceof Error ? error.message : '连接失败，请重试')}
    finally{setBusy(false)}
  }
  return <>
    <button onClick={()=>setOpen(true)} className="w-full bg-white rounded-2xl shadow-card p-4 text-left">
      <span className="block text-sm font-medium">微信日程助手</span>
      <span className="block text-xs text-gray-500 mt-1">{enabled?'已启用日程同步':'未连接'} · 记账和私人笔记不接入</span>
    </button>
    <Modal open={open} onClose={()=>setOpen(false)} title="微信日程助手">
      <div className="space-y-4">
        <p className="text-xs text-gray-600 leading-relaxed">启用后，将同步有日期和时间的单次任务标题、时间、时长及完成状态。任务描述、记账和私人笔记不发送。重复任务暂不接入微信，仍可在工作台使用。</p>
        <p className="text-xs text-gray-500">微信消息可能受会话有效期限制；手机后台同步也可能延迟。请在重要日程前检查系统日历。</p>
        <label className="block text-sm">你的助手服务地址<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://你的助手.workers.dev" className="mt-1 w-full border rounded-xl p-3" autoCapitalize="none" autoCorrect="off" /></label>
        <label className="block text-sm">手机连接密钥<input type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" className="mt-1 w-full border rounded-xl p-3" /></label>
        <button disabled={busy||!url||!token} onClick={connect} className="w-full bg-primary text-white rounded-xl p-3 disabled:opacity-40">{busy?'连接与同步中…':enabled?'立即同步':'同意仅同步日程并连接'}</button>
        {enabled&&<button className="w-full text-sm text-gray-600 py-2" onClick={async()=>{await saveAssistantConfig({url,token,enabled:false});setEnabled(false);showToast('手机同步已关闭，云端助手仍需单独解除连接')}}>关闭手机日程同步</button>}
        <p className="text-xs text-gray-500">连接密钥不会随备份导出。关闭同步不会删除云端已有日程。</p>
      </div>
    </Modal>
  </>
}
