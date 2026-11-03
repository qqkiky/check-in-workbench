import { TextInput } from '@/components/common/TextField'
import { useState } from 'react'
import { readAssistantConfig, saveAssistantConfig, syncAssistant, controlWeixin } from '@/services/assistant'
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
      if(result.connected)await controlWeixin('resume')
      showToast(`微信清单已同步：今天 ${result.todayCount} 项未完成${result.deliveryError ? '；微信发送受限，请与助手互动后重试' : result.connected ? '' : '；微信已断开或待验证，请重新扫码连接'}`)
    }catch(error){showToast(error instanceof Error ? error.message : '连接失败，请重试')}
    finally{setBusy(false)}
  }
  return <>
    <button onClick={()=>setOpen(true)} className="w-full bg-white rounded-2xl shadow-card p-4 text-left">
      <span className="block text-sm font-medium">微信日程助手</span>
      <span className="block text-xs text-gray-500 mt-1">{enabled?'已启用':'未连接'} · 同步当天清单和习惯，供微信早报使用</span>
    </button>
    <Modal open={open} onClose={()=>setOpen(false)} title="微信日程助手">
      <div className="space-y-4">
        <p className="text-xs text-gray-600 leading-relaxed">启用后，同步单次日程，并为微信早报同步习惯的重复规则及当天完成状态。早报列出当天未完成的待办、习惯和时间未定事项，不包含逾期事项。你主动发给微信的记账内容会经腾讯及助手云端处理，云端加密暂存最多7天，手机确认入账后移除。完整账本、账户列表、任务描述及私人笔记不上传；查账仍在 APK 中进行。</p>
        <p className="text-xs text-gray-500">例如“微信，午饭支出30元”或“用工资卡还招行信用卡1200元”。还款只记为账本中的账户转账，不实际划款。漏说账户、金额或收支类型会追问；账户名称须与 APK 一致。语音需要微信提供转写，没有转写时会提示补发文字。打开 APK 后自动接收入账，应用关闭期间先保持待同步；收入和支出默认归入其他收支；还款和账户转账单独记录，可在记账页查看。</p>
        <p className="text-xs text-gray-500">微信消息可能受会话有效期限制；手机后台同步也可能延迟。请在重要日程前检查系统日历。</p>
        <label className="block text-sm">你的助手服务地址<TextInput type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://你的助手.workers.dev" className="mt-1 w-full border rounded-xl p-3" autoCapitalize="none" autoCorrect="off" /></label>
        <label className="block text-sm">手机连接密钥<TextInput type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" className="mt-1 w-full border rounded-xl p-3" /></label>
        <button disabled={busy||!url||!token} onClick={connect} className="w-full bg-primary text-white rounded-xl p-3 disabled:opacity-40">{busy?'微信清单同步中…':enabled?'同步清单到微信助手':'同意上述处理并连接'}</button>
        {enabled&&<button disabled={busy} className="w-full text-sm text-gray-600 py-2" onClick={async()=>{setBusy(true);try{await controlWeixin('pause');await saveAssistantConfig({url,token,enabled:false});setEnabled(false);showToast('微信提醒和手机同步已暂停')}catch(error){showToast(error instanceof Error?error.message:'暂停失败，请重试')}finally{setBusy(false)}}}>暂停微信提醒与手机同步</button>}
        <button disabled={busy||!readAssistantConfig()} className="w-full text-sm text-red-500 py-2" onClick={async()=>{setBusy(true);try{await controlWeixin('disconnect');await saveAssistantConfig({url,token,enabled:false});setEnabled(false);showToast('微信连接已解除，旧提醒已清除；业务数据保留')}catch(error){showToast(error instanceof Error?error.message:'解除失败，请重试')}finally{setBusy(false)}}}>解除微信连接并停止提醒</button>
        <p className="text-xs text-gray-500">连接密钥不会随备份导出。暂停和解除连接均保留业务数据；重新连接后先同步最新清单，再恢复提醒。</p>
      </div>
    </Modal>
  </>
}
