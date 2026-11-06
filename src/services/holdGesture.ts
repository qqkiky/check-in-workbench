/** Capture interruption is distinct from a deliberate release. */
export class HoldGesture {
 private active:{id:number;x:number;y:number;cancel:boolean}|null=null
 private interruption:ReturnType<typeof setTimeout>|null=null
 constructor(private handlers:{start:()=>void;release:()=>void;cancel:()=>void;changed:(cancel:boolean)=>void;interrupted?:()=>void}){}
 begin(id:number,y:number,x=0){
  if(this.active){
   if(this.interruption===null||Math.hypot(this.active.x-x,this.active.y-y)>44)return
   clearTimeout(this.interruption);this.interruption=null
   this.active={id,x,y,cancel:false}
   this.handlers.changed(false)
   return
  }
  this.active={id,x,y,cancel:false};this.handlers.changed(false);this.handlers.start()
 }
 move(id:number,y:number){
  if(this.active?.id!==id||this.interruption!==null)return
  const cancel=this.active.y-y>(this.active.cancel?72:112)
  if(this.active.cancel!==cancel){this.active.cancel=cancel;this.handlers.changed(cancel)}
 }
 interrupt(id:number){
  if(this.active?.id!==id||this.interruption!==null)return
  if(this.active.cancel){this.end(id,true);return}
  this.interruption=setTimeout(()=>{
   this.interruption=null
   this.end(id,true)
   this.handlers.interrupted?.()
  },250)
 }
 end(id:number,cancelled=false){
  if(this.active?.id!==id||this.interruption!==null&&!cancelled)return
  if(this.interruption!==null){clearTimeout(this.interruption);this.interruption=null}
  const cancel=cancelled||this.active.cancel
  this.active=null;this.handlers.changed(false)
  if(cancel)this.handlers.cancel();else this.handlers.release()
 }
 cancel(){if(this.active)this.end(this.active.id,true)}
}
