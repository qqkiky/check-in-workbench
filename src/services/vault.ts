export const TABLES = ['wb.tasks.v1','wb.records.v1','wb.categories.v1','wb.notes.v1','wb.timeline.v1','wb.acct.transactions.v1','wb.acct.categories.v1','wb.acct.accounts.v1','wb.acct.transfers.v1'] as const
export const PREFERENCES = ['theme','startOfWeek','showLunar','notificationEnabled','weekStartDay','hapticsEnabled','showTimeline','budget','themeColor']
export interface Entity { id: string; [key: string]: unknown }
export interface Snapshot { schema: 1; tables: Record<string, Entity[]>; preferences: Record<string, unknown> }
export interface Conflict { id: string; table: string; label: string; local: unknown; remote: unknown }
export type Choices = Record<string,'local'|'remote'>
export function canonical(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']'
  if(value && typeof value==='object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}'
  return JSON.stringify(value)
}
export function validateSnapshot(value: Snapshot): Snapshot {
  if(value?.schema!==1 || !value.tables || !value.preferences || Object.keys(value.tables).some(key=>!TABLES.includes(key as typeof TABLES[number])))throw new Error('同步数据版本不兼容，请更新应用')
  for(const key of TABLES){
    const rows=value.tables[key]
    if(!Array.isArray(rows)||rows.some(row=>!row||typeof row.id!=='string'||!row.id)||new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('同步数据格式不正确，未写入本机')
  }
  if(Object.keys(value.preferences).some(key=>!PREFERENCES.includes(key)))throw new Error('同步设置包含不支持的字段')
  return value
}
export function mergeSnapshots(base: Snapshot|null, local: Snapshot, remote: Snapshot|null, choices: Choices={}) {
  const conflicts: Conflict[]=[]
  const choose=(table:string,id:string,b:unknown,l:unknown,r:unknown)=>{
    if(canonical(l)===canonical(r))return l
    if(base && canonical(l)===canonical(b))return r
    if(base && canonical(r)===canonical(b))return l
    if(!base && l===undefined)return r
    if(!base && r===undefined)return l
    const conflictId=table+':'+id
    if(choices[conflictId])return choices[conflictId]==='local'?l:r
    const row=(l || r) as Entity|undefined
    conflicts.push({id:conflictId,table,label:String(row?.title||row?.name||row?.content||id).slice(0,100),local:l,remote:r})
    return l
  }
  const merged:Snapshot={schema:1,tables:{},preferences:{}}
  for(const table of TABLES){
    const b=new Map((base?.tables[table]||[]).map(row=>[row.id,row]))
    const l=new Map(local.tables[table].map(row=>[row.id,row]))
    const r=new Map((remote?.tables[table]||[]).map(row=>[row.id,row]))
    merged.tables[table]=[]
    for(const id of new Set([...l.keys(),...r.keys(),...b.keys()])){
      const row=remote?choose(table,id,b.get(id),l.get(id),r.get(id)):l.get(id)
      if(row!==undefined)merged.tables[table].push(row as Entity)
    }
  }
  for(const key of PREFERENCES){
    const value=remote?choose('偏好设置',key,base?.preferences[key],local.preferences[key],remote.preferences[key]):local.preferences[key]
    if(value!==undefined)merged.preferences[key]=value
  }
  return {merged,conflicts}
}
function keyBytes(key:string) {
  if(!/^[a-fA-F0-9]{64}$/.test(key.trim()))throw new Error('数据密钥需为64位十六进制字符，请生成密钥或粘贴原设备密钥')
  return Uint8Array.from(key.trim().match(/../g)!,part=>parseInt(part,16))
}
function b64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text)}
function unb64(text:string){return Uint8Array.from(atob(text),ch=>ch.charCodeAt(0))}
export interface VaultBox { schema:1; iv:string; data:string }
export async function encryptSnapshot(snapshot:Snapshot,key:string):Promise<VaultBox>{
  const plain=new TextEncoder().encode(JSON.stringify(validateSnapshot(snapshot)))
  if(plain.length>524288)throw new Error('数据超过当前同步容量，请先导出备份')
  const cryptoKey=await crypto.subtle.importKey('raw',keyBytes(key),'AES-GCM',false,['encrypt'])
  const iv=crypto.getRandomValues(new Uint8Array(12))
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('期待-vault-v1')},cryptoKey,plain)
  return {schema:1,iv:b64(iv),data:b64(new Uint8Array(data))}
}
export async function decryptSnapshot(box:VaultBox,key:string):Promise<Snapshot>{
  const cryptoKey=await crypto.subtle.importKey('raw',keyBytes(key),'AES-GCM',false,['decrypt'])
  try{
    if(box.schema!==1||box.data.length>710000)throw new Error('invalid_box')
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv),additionalData:new TextEncoder().encode('期待-vault-v1')},cryptoKey,unb64(box.data))
    return validateSnapshot(JSON.parse(new TextDecoder().decode(plain)))
  }catch{throw new Error('无法解密云端数据：请核对原设备的数据密钥，尚未覆盖任何数据')}
}
