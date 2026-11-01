import { registerPlugin } from '@capacitor/core'

export interface SpeechEngine {
  status():Promise<{available:boolean;granted:boolean}>
  requestMicrophone():Promise<{granted:boolean}>
  start(options:{sessionId:string}):Promise<{text:string}>
  stop(options:{sessionId:string}):Promise<void>
  cancel(options:{sessionId:string}):Promise<void>
}
export const NativeSpeech=registerPlugin<SpeechEngine>('VoiceInput')
export type VoicePhase='idle'|'preparing'|'listening'|'finishing'|'ready'

// A recognizer may finish before pointer-up; never send until the user releases.
export class HoldToTalk {
  private held=false
  private sessionId=''
  private started=false
  private result:string|null=null
  private phase:VoicePhase='idle'
  constructor(private engine:SpeechEngine,private callbacks:{phase:(phase:VoicePhase)=>void;text:(text:string)=>void;error:(message:string)=>void}){}
  private setPhase(phase:VoicePhase){this.phase=phase;this.callbacks.phase(phase)}
  async press() {
    if(this.phase!=='idle')return
    const id=crypto.randomUUID();this.sessionId=id;this.held=true;this.result=null;this.setPhase('preparing')
    try {
      const status=await this.engine.status()
      if(this.sessionId!==id)return
      if(!status.available)throw new Error('这台手机没有可用的系统语音识别服务；暂时可使用输入法语音输入。')
      if(!status.granted) {
        const permission=await this.engine.requestMicrophone()
        if(this.sessionId!==id)return
        this.held=false;this.setPhase('idle')
        this.callbacks.error(permission.granted?'麦克风已允许，请重新按住说话':'未允许麦克风，语音没有发送。可在系统应用权限中开启。')
        return
      }
      if(!this.held){this.setPhase('idle');return}
      this.started=true;this.setPhase('listening')
      void this.engine.start({sessionId:id}).then(({text})=>{
        if(this.sessionId!==id)return
        this.started=false
        if(typeof text!=='string'||!text.trim())throw new Error('没有识别到清楚的语音，未发送，请重试')
        if(text.trim().length>4000)throw new Error('识别文字超过4000字，未发送，请分段说')
        this.result=text.trim()
        if(this.held)this.setPhase('ready')
        else this.deliver()
      }).catch(error=>{if(this.sessionId===id)this.fail(error)})
    } catch(error){if(this.sessionId===id)this.fail(error)}
  }
  release() {
    this.held=false
    if(this.phase==='ready'){this.deliver();return}
    if(this.started) {
      const id=this.sessionId;this.setPhase('finishing')
      void this.engine.stop({sessionId:id}).catch(error=>{if(this.sessionId===id)this.fail(error)})
    }
  }
  cancel() {
    const id=this.sessionId,started=this.started
    this.sessionId='';this.held=false;this.started=false;this.result=null;this.setPhase('idle')
    if(started)void this.engine.cancel({sessionId:id}).catch(()=>{})
  }
  private deliver() {
    const text=this.result
    this.result=null;this.sessionId='';this.setPhase('idle')
    if(text)this.callbacks.text(text)
  }
  private fail(error:unknown) {
    this.cancel()
    this.callbacks.error(error instanceof Error?error.message:'语音识别失败，未发送，请重试')
  }
}
