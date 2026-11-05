import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

const QuickChat=registerPlugin<{
  consumeLaunch():Promise<{open:boolean;taskId?:string;date?:string}>
  addListener(event:'openChat',listener:()=>void):Promise<PluginListenerHandle>
}>('QuickChat')

export function listenForQuickChat(onOpen:(context?:{taskId?:string;date?:string})=>void) {
  if(!Capacitor.isNativePlatform())return ()=>{}
  let disposed=false,listener:PluginListenerHandle|undefined
  const consume=async()=>{
    try{const result=await QuickChat.consumeLaunch();if(result.open&&!disposed)onOpen(result)}catch{/* Normal launch remains available. */}
  }
  void QuickChat.addListener('openChat',()=>void consume()).then(handle=>{
    if(disposed){void handle.remove();return}
    listener=handle;void consume()
  }).catch(()=>{})
  return ()=>{disposed=true;void listener?.remove()}
}
