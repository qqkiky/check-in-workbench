import {useState} from 'react'
import {Modal} from './common/Modal'
import {showToast} from './common/Toast'
import {readAssistantConfig} from '@/services/assistant'
import {readDataKey,generateDataKey,saveDataConnection,prepareDataSync,commitDataSync,pairDevice,newDeviceCode,type SyncPlan} from '@/services/deviceSync'
import type {Choices} from '@/services/vault'

export function DeviceSyncSettings(){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false)
  const [url,setUrl]=useState(()=>readAssistantConfig()?.url||'https://checkin-schedule-assistant.kiki-workbench-519bc4.workers.dev')
  const [token,setToken]=useState(()=>readAssistantConfig()?.token||'')
  const [pairCode,setPairCode]=useState(''),[showKey,setShowKey]=useState(false)
  const [shareCode,setShareCode]=useState('')
  const [key,setKey]=useState(readDataKey),[plan,setPlan]=useState<SyncPlan|null>(null),[choices,setChoices]=useState<Choices>({})
  async function sync(){
    setBusy(true)
    try{
      await saveDataConnection(url,token,key)
      const next=await prepareDataSync()
      if(next.conflicts.length){setPlan(next);setChoices({});return}
      await commitDataSync(next);setPlan(null);showToast('全部业务数据已加密同步，冲突不会自动覆盖')
    }catch(error){showToast(error instanceof Error?error.message:'同步失败')}
    finally{setBusy(false)}
  }
  async function resolve(){
    if(!plan)return
    setBusy(true)
    try{await commitDataSync(plan,choices);setPlan(null);showToast('已按你的选择合并并加密同步')}
    catch(error){setPlan(null);showToast(error instanceof Error?error.message:'同步失败，请重试')}
    finally{setBusy(false)}
  }
  return <>
    <button onClick={()=>setOpen(true)} className="w-full bg-white rounded-2xl shadow-card p-4 text-left">
      <span className="block text-sm font-medium">数据同步</span>
      <span className="block text-xs text-gray-500 mt-1">本机自动保存 · 用自己的密钥加密同步到其他设备</span>
    </button>
    <Modal open={open} onClose={()=>{if(!busy)setOpen(false)}} title="加密数据同步">
      <div className="space-y-4 text-sm">
        <p className="text-xs text-gray-600">同步任务、打卡、记账、账户、转账、笔记、分类和外观偏好。此通道只上传设备端加密后的密文，数据密钥不上传。微信助手的日程处理单独启用。</p>
        <label className="block">服务地址<input disabled={busy} type="url" value={url} onChange={e=>{setUrl(e.target.value);setToken('');setPlan(null)}} className="mt-1 w-full border rounded-xl p-3" autoCapitalize="none" /></label>
        {token?<div className="space-y-2">
          <p className="text-green-700">服务已连接</p>
          <button disabled={busy} className="text-primary disabled:opacity-40" onClick={async()=>{setBusy(true);try{setShareCode(await newDeviceCode())}catch(error){showToast(error instanceof Error?error.message:'生成失败')}finally{setBusy(false)}}}>连接另一台设备</button>
          {shareCode&&<p className="text-xs text-gray-600">新设备连接码：<strong className="text-lg tracking-widest">{shareCode}</strong>。10分钟内使用一次；新设备还需填写你保存的数据密钥。</p>}
        </div>:<div className="space-y-2">
          <label className="block">一次性设备连接码<input disabled={busy} inputMode="numeric" maxLength={8} value={pairCode} onChange={e=>setPairCode(e.target.value.replace(/\D/g,''))} className="mt-1 w-full border rounded-xl p-3" placeholder="8位连接码" /></label>
          <button disabled={busy||pairCode.length!==8} className="text-primary disabled:opacity-40" onClick={async()=>{setBusy(true);try{setToken(await pairDevice(url,pairCode));setPairCode('');showToast('设备已连接')}catch(error){showToast(error instanceof Error?error.message:'连接失败')}finally{setBusy(false)}}}>连接此设备</button>
        </div>}
        <label className="block">你的数据加密密钥<input disabled={busy} type={showKey?'text':'password'} value={key} onChange={e=>{setKey(e.target.value);setPlan(null)}} className="mt-1 w-full border rounded-xl p-3" autoComplete="off" placeholder="新设备粘贴原设备密钥" /></label>
        <div className="flex gap-3">
          <button disabled={busy||!!key} onClick={()=>setKey(generateDataKey())} className="text-primary disabled:opacity-40">生成新密钥</button>
          <button disabled={busy||!key} onClick={async()=>{try{await navigator.clipboard.writeText(key);showToast('已复制，请保存在自己的密码管理器中')}catch{showToast('请长按密钥输入框选择复制')}}} className="text-primary disabled:opacity-40">复制数据密钥</button>
          <button onClick={()=>setShowKey(!showKey)} className="text-primary">{showKey?'隐藏密钥':'显示密钥'}</button>
        </div>
        <p className="text-xs text-gray-500">新设备先使用一次性连接码连接，再填原设备的数据密钥。数据密钥丢失后，云端无法恢复；卸载前请保存密钥并导出备份。按钮执行双向合并，未点击时仍自动保存到本机。</p>
        {plan&&<div className="space-y-3">
          <p>以下内容两边都改过，请逐项选择；尚未覆盖任何一边：</p>
          {plan.conflicts.map(conflict=><div key={conflict.id} className="rounded-xl border p-3 space-y-2">
            <p className="font-medium break-words">{conflict.label}</p>
            {(['local','remote'] as const).map(side=><label key={side} className="block border rounded-lg p-2">
              <input type="radio" checked={choices[conflict.id]===side} onChange={()=>setChoices({...choices,[conflict.id]:side})} /> {side==='local'?'保留此设备':'保留云端'}
              <pre className="mt-1 text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">{conflict[side]===undefined?'已删除':JSON.stringify(conflict[side],null,2)}</pre>
            </label>)}
          </div>)}
          <button disabled={busy||plan.conflicts.some(item=>!choices[item.id])} onClick={resolve} className="w-full bg-primary text-white p-3 rounded-xl disabled:opacity-40">按选择合并同步</button>
        </div>}
        <button disabled={busy||!url||!token||!key} onClick={sync} className="w-full bg-primary text-white p-3 rounded-xl disabled:opacity-40">{busy?'加密与同步中…':plan?'重新检查数据':'立即加密同步'}</button>
      </div>
    </Modal>
  </>
}
