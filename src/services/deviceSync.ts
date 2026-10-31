import { appStorage, flushPrivateStorage, saveStorageBatch } from './appStorage'
import { useStore } from '@/store'
import { endpoint, readAssistantConfig, saveAssistantConfig, lockAssistantForDataSync } from './assistant'
import { TABLES,PREFERENCES,canonical,mergeSnapshots,encryptSnapshot,decryptSnapshot,type Snapshot,type Choices,type VaultBox } from './vault'

const KEY='wb.sync.vault.key.v1', BASE='wb.sync.vault.base.v1'
export const readDataKey=()=>appStorage.getItem(KEY)||''
export function generateDataKey(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')}
export async function pairDevice(url:string,code:string){
  const response=await fetch(endpoint(url)+'/v1/device-pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),redirect:'error',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error('连接码无效、已使用或已过期，请申请新的连接码')
  const data=await response.json()
  await saveAssistantConfig({url,token:data.token,enabled:!!readAssistantConfig()?.enabled})
  return data.token as string
}
export async function newDeviceCode():Promise<string>{
  const config=readAssistantConfig();if(!config?.token)throw new Error('请先连接此设备')
  const response=await fetch(endpoint(config.url)+'/v1/device-code',{method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error('生成连接码失败，请重试')
  return (await response.json()).code
}
export async function saveDataConnection(url:string,token:string,key:string){
  if(!/^[a-fA-F0-9]{64}$/.test(key.trim()))throw new Error('请生成密钥或填写原设备的64位数据密钥')
  const previous=readAssistantConfig()
  if(key.trim().toLowerCase()!==readDataKey() || endpoint(url)!==previous?.url || token.trim()!==previous?.token){
    const remote=await request(undefined,{url:endpoint(url),token:token.trim(),enabled:!!previous?.enabled})
    if(remote.box)await decryptSnapshot(remote.box,key)
  }
  await saveAssistantConfig({url,token,enabled:!!readAssistantConfig()?.enabled})
  appStorage.setItem(KEY,key.trim().toLowerCase());await flushPrivateStorage()
}
export function captureSnapshot():Snapshot {
  const tables=Object.fromEntries(TABLES.map(key=>[key,JSON.parse(appStorage.getItem(key)||'[]')]))
  const settings=JSON.parse(appStorage.getItem('wb.settings.v1')||'{}')
  return {schema:1,tables,preferences:Object.fromEntries(PREFERENCES.filter(key=>Object.prototype.hasOwnProperty.call(settings,key)).map(key=>[key,settings[key]]))}
}
async function request(data?:unknown,config=readAssistantConfig()){
  if(!config?.url||!config.token)throw new Error('请先填写服务地址和服务连接密钥')
  const response=await fetch(endpoint(config.url)+'/v1/data-sync',{method:data?'POST':'GET',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,redirect:'error',signal:AbortSignal.timeout(20000),cache:'no-store'})
  if(response.status===409)throw new Error('另一台设备刚更新了数据，请重新同步；未覆盖其修改')
  if(!response.ok)throw new Error(`数据同步失败（${response.status}）`)
  return response.json() as Promise<{version:number;box:VaultBox|null}>
}
export interface SyncPlan { base:Snapshot|null;local:Snapshot;remote:Snapshot|null;version:number;binding:string;conflicts:ReturnType<typeof mergeSnapshots>['conflicts'] }
async function binding(){const config=readAssistantConfig();return canonical([config?.url,readDataKey()])}
export async function prepareDataSync():Promise<SyncPlan>{
  const key=readDataKey();if(!key)throw new Error('请先设置数据密钥')
  const remote=await request()
  const decrypted=remote.box?await decryptSnapshot(remote.box,key):null
  const identity=await binding()
  const saved=JSON.parse(appStorage.getItem(BASE)||'null')
  const base=saved?.binding===identity?saved.snapshot as Snapshot:null
  const local=captureSnapshot()
  return {base,local,remote:decrypted,version:remote.version,binding:identity,conflicts:mergeSnapshots(base,local,decrypted).conflicts}
}
let committing=false
export async function commitDataSync(plan:SyncPlan,choices:Choices={}){
  if(committing)throw new Error('正在同步，请稍候')
  const releaseAssistant=lockAssistantForDataSync()
  committing=true
  try{
    if(await binding()!==plan.binding || canonical(captureSnapshot())!==canonical(plan.local))throw new Error('本机数据或连接已变化，请重新同步')
    const {merged,conflicts}=mergeSnapshots(plan.base,plan.local,plan.remote,choices)
    if(conflicts.length)throw new Error('请先选择所有冲突的保留内容')
    const box=await encryptSnapshot(merged,readDataKey())
    if(await binding()!==plan.binding || canonical(captureSnapshot())!==canonical(plan.local))throw new Error('本机数据或连接已变化，请重新同步')
    const result=await request({baseVersion:plan.version,box})
    if(await binding()!==plan.binding || canonical(captureSnapshot())!==canonical(plan.local))throw new Error('云端已接收；本机又有新修改，请再次同步以合并，尚未覆盖本机')
    const updates:Record<string,string>=Object.fromEntries(TABLES.map(key=>[key,JSON.stringify(merged.tables[key])]))
    const settings=JSON.parse(appStorage.getItem('wb.settings.v1')||'{}')
    for(const key of PREFERENCES)delete settings[key]
    updates['wb.settings.v1']=JSON.stringify({...settings,...merged.preferences})
    updates['wb.initialized.v1']='1'
    updates[BASE]=JSON.stringify({binding:plan.binding,snapshot:merged,version:result.version})
    await saveStorageBatch(updates);useStore.getState().reload()
    return result.version
  }finally{committing=false;releaseAssistant()}
}
