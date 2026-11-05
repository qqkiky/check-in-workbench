/** Losing capture alone never means the user released their finger. */
export class HoldGesture {
 private active:{id:number;y:number;cancel:boolean}|null=null
 constructor(private handlers:{start:()=>void;release:()=>void;cancel:()=>void;changed:(cancel:boolean)=>void}){}
 begin(id:number,y:number){if(this.active)return;this.active={id,y,cancel:false};this.handlers.changed(false);this.handlers.start()}
 move(id:number,y:number){if(this.active?.id!==id)return;const cancel=this.active.y-y>(this.active.cancel?72:112);this.active.cancel=cancel;this.handlers.changed(cancel)}
 end(id:number,cancelled=false){if(this.active?.id!==id)return;const cancel=cancelled||this.active.cancel;this.active=null;this.handlers.changed(false);if(cancel)this.handlers.cancel();else this.handlers.release()}
 cancel(){if(this.active)this.end(this.active.id,true)}
}
