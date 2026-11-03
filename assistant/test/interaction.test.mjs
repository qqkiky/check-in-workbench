import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {disconnectWeixin,connectionStatus,freshOutbound} from '../src/weixinSession.mjs';
import {applyConversationActions,effectiveAgenda} from '../src/taskCommands.mjs';
import {activeFocus,cleanInterpretation} from '../src/conversation.mjs';
import {applyBookkeeping,bookkeepingInput,receiveBookkeeping} from '../src/bookkeeping.mjs';

const at=Date.parse('2026-11-03T13:00:00+08:00');
const task={id:'report',title:'撰写实验总结',date:'2026-11-03',time:'15:00',status:'pending',duration:30,version:2,updatedAt:at,reminderEnabled:true};
const habit={id:'exercise',title:'简单锻炼',date:'',time:'20:00',createdDate:'2026-10-01',recurrence:'daily',weekdays:[],monthDay:0,excludedDates:[],completedDates:[],completed:false};
async function fixture(initial) {
  const key=await crypto.subtle.importKey('raw',Buffer.alloc(32,7),'AES-GCM',false,['encrypt','decrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12)),box=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(initial)));
  let row={version:1,ciphertext:JSON.stringify({iv:Buffer.from(iv).toString('base64'),data:Buffer.from(box).toString('base64')})};
  const env={ADMIN_TOKEN:'ADMIN',DEVICE_TOKEN:'DEVICE',STORAGE_KEY:Buffer.alloc(32,7).toString('base64'),DB:{prepare(sql){return {args:[],bind(...args){this.args=args;return this},first:async()=>row,async run(){
    if(sql.includes('poll_lease'))return {meta:{changes:1}};
    if(this.args[1]!==row.version)return {meta:{changes:0}};
    row={version:row.version+1,ciphertext:this.args[0]};return {meta:{changes:1}};
  }}}}};
  return {env,async read(){const b=JSON.parse(row.ciphertext);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(b.iv,'base64')},key,Buffer.from(b.data,'base64'))));}};
}
async function poll(env){const waits=[];worker.scheduled({},env,{waitUntil(p){waits.push(p)}});await Promise.all(waits)}
const initial=()=>({tasks:[{...task}],agenda:{version:1,tasks:[structuredClone(habit)]},seen:[],outbox:[{key:'reminder-report-old',text:'OLD',clientId:'old',taskId:'report',taskVersion:1}],cursor:'',botToken:'TEST_TOKEN',owner:'OWNER',contextToken:'CTX',connectionStatus:'connected',settings:{morningTime:'08:00',followupMinutes:30,quietStart:'00:00',quietEnd:'23:59'}});

test('revoked WeChat login clears transport and stale queue but retains schedules and pending bills',async()=>{
  const seed=initial();seed.bookkeeping=[{id:'pending-bill'}];const f=await fixture(seed),original=globalThis.fetch;let requests=0;
  globalThis.fetch=async()=>{requests++;return Response.json({errcode:-14});};
  try {await poll(f.env);const state=await f.read();assert.equal(connectionStatus(state),'disconnected');assert.equal(state.botToken,undefined);assert.deepEqual(state.outbox,[]);assert.equal(state.tasks[0].id,'report');assert.equal(state.bookkeeping.length,1);await poll(f.env);assert.equal(requests,1);}
  finally{globalThis.fetch=original}
});
test('a transient network failure does not revoke the login, and an old task-version reminder is never sent',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:at});
  const f=await fixture(initial()),original=globalThis.fetch;let fail=true,sent=0;
  globalThis.fetch=async(url)=>{if(fail)throw Error('offline');if(String(url).endsWith('/getupdates'))return Response.json({msgs:[]});sent++;return Response.json({ret:0});};
  try {await poll(f.env);assert.equal((await f.read()).botToken,'TEST_TOKEN');fail=false;await poll(f.env);assert.equal(sent,0);assert.equal((await f.read()).outbox.length,0);}
  finally{globalThis.fetch=original}
});
test('authenticated disconnect during an in-flight poll prevents late replies and keeps business data',async()=>{
  const f=await fixture(initial()),original=globalThis.fetch;let sent=0;
  globalThis.fetch=async(url)=>{if(String(url).endsWith('/getupdates')){
    const response=await worker.fetch(new Request('https://test.workers.dev/v1/weixin/control',{method:'POST',headers:{Authorization:'Bearer DEVICE'},body:JSON.stringify({action:'disconnect'})}),f.env);
    assert.equal(response.status,200);return Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'late',item_list:[{text_item:{text:'今天的安排'}}]}]});
  }sent++;return Response.json({ret:0});};
  try{await poll(f.env);assert.equal(sent,0);const state=await f.read();assert.equal(state.tasks.length,1);assert.equal(state.seen.length,0);}
  finally{globalThis.fetch=original}
});
test('date-only rescheduling keeps the time, then a pronoun completes that same task',async()=>{
  const s=initial(),f=await fixture(s),original=globalThis.fetch;let message='把实验小结挪到明天',number=0;
  f.env.AI={async run(_model,input){const context=JSON.parse(input.messages.at(-1).content);assert.ok(context.pending.some(row=>row.id==='report'&&row.title==='撰写实验总结'));if(number===2){assert.equal(context.message,'这件事做完了');assert.equal(context.recent.id,'report');return {response:JSON.stringify({actions:[{type:'complete',query:'report'}]})};}return {response:JSON.stringify({actions:[{type:'update',query:'report',date:'2026-11-04'}]})};}};
  globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'meaning-'+(++number),context_token:'CTX',item_list:[{text_item:{text:message}}]}]}):Response.json({ret:0});
  try{await poll(f.env);let state=await f.read();assert.equal(state.tasks[0].date,'2026-11-04');assert.equal(state.tasks[0].time,'15:00');message='这件事做完了';await poll(f.env);state=await f.read();assert.equal(state.tasks[0].status,'completed');assert.equal(state.tasks.length,1);}
  finally{globalThis.fetch=original}
});
test('a repeated habit moves only one occurrence, and an untimed todo can be completed through the inbox',()=>{
  const state=initial();
  let result=applyConversationActions(state,[{type:'update',query:'exercise',date:'2026-11-04'}],at,'move');
  const rules=effectiveAgenda(state),source=rules.find(row=>row.id==='exercise'),moved=rules.find(row=>row.id!=='exercise');
  assert.deepEqual(source.excludedDates,['2026-11-03']);assert.equal(source.recurrence,'daily');assert.equal(moved.date,'2026-11-04');assert.equal(moved.time,'20:00');
  state.scheduleFocus={id:result.focusId,updatedAt:at};assert.equal(activeFocus(state,at+100).id,moved.id);
  state.agenda.tasks.push({...habit,id:'untimed',title:'整理资料',recurrence:'none',time:'',date:'2026-11-03'});
  applyConversationActions(state,[{type:'complete',query:'untimed'}],at,'done');
  assert.equal(effectiveAgenda(state).find(row=>row.id==='untimed').completed,true);
  assert.equal(state.taskCommands.length,2);assert.equal(state.tasks[0].status,'pending');
});
test('repayment is a pending book transfer; missing amount is asked, not inferred, and an acknowledged record is removed',()=>{
  const state={};
  assert.deepEqual(bookkeepingInput('我用工资卡支付了招行信用卡的欠款'),{transfer:true});
  assert.equal(bookkeepingInput('提醒我明天还信用卡'),null);
  let parsed=cleanInterpretation({actions:[{type:'transfer',fromAccount:'工资卡',toAccount:'招行信用卡'}]});
  assert.match(applyBookkeeping(state,parsed.actions[0],'repay',at),/多少元/);assert.equal(state.bookkeeping.length,0);
  parsed=cleanInterpretation({actions:[{type:'transfer',fromAccount:'工资卡',toAccount:'招行信用卡',amountCents:120000,feeCents:100}]});
  assert.match(applyBookkeeping(state,parsed.actions[0],'amount',at),/不会实际划款/);
  assert.equal(state.bookkeeping[0].type,'transfer');assert.equal(state.bookkeeping[0].amountCents,120000);assert.equal(state.bookkeeping[0].id,'wxbook-repay');
  receiveBookkeeping(state,[{id:'wxbook-repay',version:1,status:'applied'}]);assert.deepEqual(state.bookkeeping,[]);
  for(const change of [{amountCents:0},{amountCents:10.5},{feeCents:-1}])assert.throws(()=>cleanInterpretation({actions:[{type:'transfer',...change}]}));
  assert.throws(()=>cleanInterpretation({actions:[{type:'transfer',amountCents:100},{type:'complete',query:'report'}]}));
});

test('a transfer never creates an empty schedule draft, even if the model returns one',()=>{
 const parsed=cleanInterpretation({actions:[{type:'transfer',fromAccount:'工资卡',toAccount:'招行信用卡'}],draft:{items:[{}],question:'多少钱？'}});
 assert.equal(parsed.draft,undefined);assert.equal(parsed.actions[0].type,'transfer');
 const state={};applyBookkeeping(state,parsed.actions[0],'missing',at);
 assert.equal(state.bookkeepingDraft.fromAccount,'工资卡');assert.equal(state.bookkeepingDraft.toAccount,'招行信用卡');assert.equal(state.scheduleDraft,undefined);
});

test('model date-only reschedule is accepted as a partial update and never asks for the known time',()=>{
 const parsed=cleanInterpretation({actions:[{type:'reschedule',query:'report',date:'2026-11-04'}]},at,null,[task]);
 assert.deepEqual(parsed.actions,[{type:'update',query:'report',date:'2026-11-04'}]);
 const state=initial();applyConversationActions(state,parsed.actions,at,'date-only');
 assert.equal(state.tasks[0].time,'15:00');assert.equal(state.tasks[0].date,'2026-11-04');
});

test('an existing candidate ID from the real model is normalized, while an unknown ID is rejected',()=>{
 const parsed=cleanInterpretation({actions:[{type:'update',id:'report',date:'2026-11-04'}]},at,null,[task]);
 assert.deepEqual(parsed.actions,[{type:'update',query:'report',date:'2026-11-04'}]);
 assert.deepEqual(cleanInterpretation({actions:[{type:'complete',taskId:'report'}]},at,null,[task]).actions,[{type:'complete',query:'report'}]);
 assert.throws(()=>cleanInterpretation({actions:[{type:'update',id:'unknown',date:'2026-11-04'}]},at,null,[task]));
});
