import { Capacitor, CapacitorHttp } from '@capacitor/core'
export type InfoFile='consult-data.json'|'monthly-summary.json'
export interface InfoResult<T>{data:T;source:'online'|'cache'|'bundled'}
const BASE='https://qqkiky.github.io/check-in-workbench/'
const pending=new Map<string,Promise<InfoResult<any>>>()
const checked=new Map<string,{at:number;result:InfoResult<any>}>()
function validate(file:InfoFile,raw:unknown){
 const data=typeof raw==='string'?JSON.parse(raw):raw
 if(!data||typeof data!=='object'||!data.generatedAt||!Number.isFinite(Date.parse(data.generatedAt)))throw Error('Invalid news')
 if(file==='consult-data.json'&&(!data.sections||!['industry','drug','regulatory'].every(k=>Array.isArray(data.sections[k]))))throw Error('Invalid sections')
 if(file==='monthly-summary.json'&&(!data.months||typeof data.months!=='object'||Array.isArray(data.months)))throw Error('Invalid archive')
 const groups=file==='consult-data.json'?[data]:Object.values(data.months)
 for(const group of groups as any[])for(const items of Object.values(group.sections||{}) as any[]) {
  if(!Array.isArray(items))throw Error('Invalid items')
  for(const item of items)if(!item||typeof item.title!=='string'||typeof item.url!=='string'||!/^https?:\/\//i.test(item.url))throw Error('Invalid link')
 }
 return data
}
export async function loadInfo<T>(file:InfoFile,force=false):Promise<InfoResult<T>>{
 if(!['consult-data.json','monthly-summary.json'].includes(file))throw Error('Unknown news file')
 const recent=checked.get(file);if(!force&&recent&&Date.now()-recent.at<5*60000)return recent.result
 const existing=pending.get(file);if(existing)return existing
 const key='info.public.cache.v1.'+file
 const run=(async()=>{
  let result:InfoResult<T>
  try{
   let raw:unknown
   if(Capacitor.getPlatform()==='android'){
    const response=await CapacitorHttp.get({url:BASE+file+'?t='+Date.now(),connectTimeout:10000,readTimeout:15000,disableRedirects:true})
    if(response.status!==200)throw Error('News offline');raw=response.data
   }else{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000)
    try{const response=await fetch(file+'?t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('News offline');raw=await response.json()}finally{clearTimeout(timer)}
   }
   const data=validate(file,raw);result={data,source:'online'}
   try{localStorage.setItem(key,JSON.stringify(data))}catch{/* A full public cache must not block reading. */}
  }catch{
   let cached:unknown;try{cached=validate(file,localStorage.getItem(key))}catch{}
   if(cached)result={data:cached as T,source:'cache'}
   else{const response=await fetch(file);if(!response.ok)throw Error('News unavailable');result={data:validate(file,await response.json()),source:'bundled'}}
  }
  checked.set(file,{at:Date.now(),result});return result
 })()
 pending.set(file,run)
 try{return await run}finally{pending.delete(file)}
}
