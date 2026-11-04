import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {disconnectWeixin,connectionStatus,freshOutbound} from '../src/weixinSession.mjs';
import {applyConversationActions,effectiveAgenda} from '../src/taskCommands.mjs';
import {activeFocus,cleanInterpretation,followupActions,rememberFocus} from '../src/conversation.mjs';
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

test('move, complete and explicit pronoun correction restore just the same task and preserve its moved plan',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:at});
  const seed=initial();seed.tasks.push({...task,id:'other',title:'其他事项',status:'completed',completedAt:at-1000});
  const f=await fixture(seed),original=globalThis.fetch;let step=0,aiCalls=0;
  const messages=['把实验小结挪到明天','这件事做完了','我搞错了其实这件事没做完'];
  f.env.AI={async run(){aiCalls++;if(step===1)return {response:JSON.stringify({actions:[{type:'update',query:'report',date:'2026-11-04'}]})};if(step===2)return {response:JSON.stringify({actions:[{type:'complete',query:'report'}]})};throw Error('the explicit correction must work without another model call');}};
  globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'undo-'+(++step),context_token:'CTX',item_list:[{text_item:{text:messages[step-1]}}]}]}):Response.json({ret:0});
  try {
    await poll(f.env);await poll(f.env);let state=await f.read();assert.equal(state.tasks[0].status,'completed');
    await poll(f.env);state=await f.read();assert.equal(state.tasks[0].status,'pending');assert.equal(state.tasks[0].completedAt,null);
    assert.equal(state.tasks[0].date,'2026-11-04');assert.equal(state.tasks[0].time,'15:00');assert.equal(state.tasks[1].status,'completed');assert.equal(state.tasks.length,2);assert.equal(aiCalls,2);
  }finally{globalThis.fetch=original}
});

test('a completed focus stays available, while bare clocks, unrelated names, negated undo and expired focus never reopen it',()=>{
 const done={...task,status:'completed',completedAt:at},state={tasks:[done]};
 rememberFocus(state,[task],[done],at); // The version must change for a new operation.
 state.scheduleFocus={id:done.id,date:done.date,updatedAt:at};
 assert.equal(activeFocus(state,at+100).status,'completed');
 for(const text of ['我搞错了，其实这件事没做完','这件事其实没完成','撤销刚才的完成'])assert.equal(followupActions(state,text,at+100).actions[0].type,'reopen');
 for(const text of ['下午三点','完成时间改成下午三点','不是没完成，是完成时间说错了','另一项事项没做完','不要撤销完成，只改完成时间','列出未完成事项'])assert.equal(followupActions(state,text,at+100),null);
 assert.equal(followupActions(state,'这件事没做完',at+15*60000),null);
 assert.throws(()=>cleanInterpretation({actions:[{type:'reopen',id:'unknown'}]},at,null,[done]));
 assert.deepEqual(cleanInterpretation({actions:[{type:'reopen',id:done.id,date:done.date}]},at,null,[done]).actions,[{type:'reopen',query:done.id,date:done.date}]);
});
test('duplicate completed names need clarification, and an exact ID restores only its matching completion',()=>{
 const state=initial();state.tasks=[{...task,status:'completed',completedAt:at},{...task,id:'duplicate',status:'completed',completedAt:at},{...task,id:'pending-copy'}];
 const result=applyConversationActions(state,[{type:'reopen',query:task.title}],at,'ambiguous');
 assert.match(result.reply,/多项/);assert.equal(state.tasks.filter(task=>task.status==='completed').length,2);
 applyConversationActions(state,[{type:'reopen',query:task.id}],at,'exact');
 assert.equal(state.tasks[0].status,'pending');assert.equal(state.tasks[0].date,task.date);assert.equal(state.tasks[0].time,task.time);assert.equal(state.tasks[1].status,'completed');assert.equal(state.tasks[2].status,'pending');
});
test('a model cannot undo completion when the user only corrects the completion time',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});const seed=initial();seed.tasks[0]={...task,status:'completed',completedAt:at};seed.scheduleFocus={id:task.id,updatedAt:at};
 const f=await fixture(seed),original=globalThis.fetch;f.env.AI={async run(){return {response:JSON.stringify({actions:[{type:'reopen',query:task.id}]})};}};
 globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'time-only',context_token:'CTX',item_list:[{text_item:{text:'完成时间不是三点，是四点'}}]}]}):Response.json({ret:0});
 try{await poll(f.env);const state=await f.read();assert.equal(state.tasks[0].status,'completed');assert.equal(state.tasks[0].completedAt,at);assert.equal(state.tasks[0].version,task.version);}
 finally{globalThis.fetch=original}
});
test('habit completion and reopening before phone reception project only the chosen occurrence',()=>{
 const state=initial();
 const done=applyConversationActions(state,[{type:'complete',query:habit.id,date:'2026-11-04'}],at,'habit-done');
 state.scheduleFocus={id:done.focusId,date:done.focusDate,updatedAt:at};
 assert.equal(activeFocus(state,at+100).status,'completed');assert.equal(activeFocus(state,at+100).date,'2026-11-04');
 const correction=followupActions(state,'我搞错了其实这件事没做完',at+100);
 applyConversationActions(state,correction.actions,at+100,'habit-undone');
 assert.deepEqual(effectiveAgenda(state).find(task=>task.id===habit.id).completedDates,[]);assert.equal(state.taskCommands.length,2);
 assert.equal(state.agenda.tasks[0].recurrence,'daily');assert.equal(state.agenda.tasks[0].time,'20:00');
});

test('querying unfinished items or explicitly forbidding undo cannot authorize a model reopen',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});
 for(const text of ['列出未完成事项','不要撤销完成，只改完成时间']) {
  const seed=initial();seed.tasks[0]={...task,status:'completed',completedAt:at};const f=await fixture(seed),original=globalThis.fetch;
  f.env.AI={async run(){return {response:JSON.stringify({actions:[{type:'reopen',query:task.id}]})};}};
  globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'guard',context_token:'CTX',item_list:[{text_item:{text}}]}]}):Response.json({ret:0});
  try{await poll(f.env);assert.equal((await f.read()).tasks[0].status,'completed');}finally{globalThis.fetch=original}
 }
});

test('voice completion of the bookkeeping habit is a task action and never opens a financial draft',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});const seed=initial();seed.agenda.tasks.push({...habit,id:'bookkeeping-task',title:'记账',time:'23:00'});
 const f=await fixture(seed),original=globalThis.fetch;let delivered=false;
 globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:delivered?[]:(delivered=true,[{from_user_id:'OWNER',message_type:1,message_id:'bookkeeping-habit',context_token:'CTX',item_list:[{voice_item:{text:'今天的记账做完了。'}}]}])}):Response.json({ret:0});
 try {await poll(f.env);const state=await f.read();assert.equal(state.bookkeepingDraft,undefined);assert.equal((state.bookkeeping||[]).length,0);assert.ok(effectiveAgenda(state).find(task=>task.id==='bookkeeping-task').completedDates.includes('2026-11-03'));assert.deepEqual(effectiveAgenda(state).find(task=>task.id===habit.id).completedDates,[]);}
 finally{globalThis.fetch=original}
});

test('explicit task correction clears an empty mistaken bill but preserves a genuine incomplete bill',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});
 for(const meaningful of [false,true]) {
  const seed=initial();seed.agenda.tasks.push({...habit,id:'bookkeeping-task',title:'记账',time:'23:00'});
  const old=meaningful?{id:'wxbook-real',date:'2026-11-03',createdAt:at,amountCents:3000,type:'expense',note:'午饭'}:{id:'wxbook-mistake',date:'2026-11-03',createdAt:at,note:'的做完了'};
  seed.bookkeepingDraft=structuredClone(old);const f=await fixture(seed),original=globalThis.fetch;
  globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'clarify-task',context_token:'CTX',item_list:[{voice_item:{text:'你就把记账这件事勾选了就。'}}]}]}):Response.json({ret:0});
  try{await poll(f.env);const state=await f.read();assert.ok(effectiveAgenda(state).find(task=>task.id==='bookkeeping-task').completedDates.includes('2026-11-03'));if(meaningful)assert.deepEqual(state.bookkeepingDraft,old);else assert.equal(state.bookkeepingDraft,undefined);assert.equal((state.bookkeeping||[]).length,0);}
  finally{globalThis.fetch=original}
 }
});
test('an actual expense containing the word bookkeeping remains financial and never checks off the habit',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});const seed=initial();seed.agenda.tasks.push({...habit,id:'bookkeeping-task',title:'记账',time:'23:00'});
 const f=await fixture(seed),original=globalThis.fetch;
 globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'real-expense',context_token:'CTX',item_list:[{text_item:{text:'微信午饭支出30元，记账完成了'}}]}]}):Response.json({ret:0});
 try{await poll(f.env);const state=await f.read();assert.equal(state.bookkeeping.length,1);assert.equal(state.bookkeeping[0].amountCents,3000);assert.equal(state.bookkeeping[0].type,'expense');assert.deepEqual(effectiveAgenda(state).find(task=>task.id==='bookkeeping-task').completedDates,[]);}
 finally{globalThis.fetch=original}
});
test('natural rejection of the previous bill clears only that draft instead of cancelling a task',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});const seed=initial();seed.bookkeepingDraft={id:'wxbook-mistake',createdAt:at,date:'2026-11-03',note:'的做完了'};
 const f=await fixture(seed),original=globalThis.fetch;
 globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'cancel-draft',context_token:'CTX',item_list:[{voice_item:{text:'不接上一笔了，去。'}}]}]}):Response.json({ret:0});
 try{await poll(f.env);const state=await f.read();assert.equal(state.bookkeepingDraft,undefined);assert.deepEqual(state.tasks,seed.tasks);assert.deepEqual(state.agenda,seed.agenda);}
 finally{globalThis.fetch=original}
});
test('duplicate bookkeeping task names are clarified without opening a bill or checking either item',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});const seed=initial();seed.agenda.tasks.push({...habit,id:'book-a',title:'记账',time:'22:00'},{...habit,id:'book-b',title:'记账',time:'23:00'});
 const f=await fixture(seed),original=globalThis.fetch,sent=[];
 globalThis.fetch=async(url,options)=>{if(String(url).endsWith('/getupdates'))return Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'duplicate-task',context_token:'CTX',item_list:[{text_item:{text:'今天的记账做完了'}}]}]});sent.push(JSON.parse(options.body).msg.item_list[0].text_item.text);return Response.json({ret:0});};
 try{await poll(f.env);const state=await f.read();assert.equal(state.bookkeepingDraft,undefined);assert.ok(sent.some(text=>text.includes('多项同名')));assert.deepEqual(effectiveAgenda(state).find(task=>task.id==='book-a').completedDates,[]);assert.deepEqual(effectiveAgenda(state).find(task=>task.id==='book-b').completedDates,[]);}
 finally{globalThis.fetch=original}
});
test('repeating an already-completed bookkeeping habit keeps the reference and clears only a mistaken empty draft',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});const seed=initial();seed.agenda.tasks.push({...habit,id:'book-done',title:'记账',time:'23:00',completedDates:['2026-11-03'],completed:true});seed.bookkeepingDraft={id:'wxbook-mistake',createdAt:at,date:'2026-11-03',note:'的做完了'};
 const f=await fixture(seed),original=globalThis.fetch;
 globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'already-done',context_token:'CTX',item_list:[{text_item:{text:'今天的记账做完了'}}]}]}):Response.json({ret:0});
 try{await poll(f.env);const state=await f.read();assert.equal(state.bookkeepingDraft,undefined);assert.equal(state.scheduleFocus.id,'book-done');assert.deepEqual(effectiveAgenda(state).find(task=>task.id==='book-done').completedDates,['2026-11-03']);}
 finally{globalThis.fetch=original}
});

test('bookkeeping task completion and immediate undo keep one reference after recovering from the mistaken bill draft',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});const seed=initial();seed.agenda.tasks.push({...habit,id:'book-task',title:'记账',time:'23:00'});seed.bookkeepingDraft={id:'wxbook-mistake',createdAt:at,date:'2026-11-03',note:'的做完了'};
 const f=await fixture(seed),original=globalThis.fetch;let delivered=false;
 globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:delivered?[]:(delivered=true,['今天的记账做完了。','我搞错了其实这件事没做完'].map((text,index)=>({from_user_id:'OWNER',message_type:1,message_id:'book-flow-'+index,context_token:'CTX',item_list:[{voice_item:{text}}]})))}):Response.json({ret:0});
 try{await poll(f.env);const state=await f.read();assert.equal(state.bookkeepingDraft,undefined);assert.equal((state.bookkeeping||[]).length,0);assert.deepEqual(state.taskCommands.map(command=>command.action.type),['complete','reopen']);assert.deepEqual(effectiveAgenda(state).find(task=>task.id==='book-task').completedDates,[]);assert.equal(effectiveAgenda(state).find(task=>task.id==='book-task').time,'23:00');assert.equal(state.scheduleFocus.id,'book-task');}
 finally{globalThis.fetch=original}
});
test('an ambiguous bookkeeping acknowledgement does not override a genuine financial follow-up',()=>{
 const state=initial();state.agenda.tasks.push({...habit,id:'book-task',title:'记账'});state.bookkeepingDraft={id:'wxbook-real',createdAt:at,amountCents:3000,type:'expense',note:'午饭'};
 assert.equal(followupActions(state,'记账完成了',at),null);
 assert.equal(followupActions(state,'今天的记账做完了',at).actions[0].query,'book-task');
});

test('spoken self-corrections with or without I restore the focused task and never guess a missing or different target',()=>{
 const done={...task,status:'completed',completedAt:at},state={tasks:[done],scheduleFocus:{id:done.id,date:done.date,updatedAt:at}};
 for(const text of ['搞错了，其实这件事没做完','说错了，这件事其实没做完','我搞错了，其实这件事没做完']) {
  assert.deepEqual(followupActions(state,text,at+100)?.actions,[{type:'reopen',query:done.id,date:done.date}]);
  assert.equal(followupActions({tasks:[done]},text,at+100),null);
 }
 for(const text of ['搞错了，另一件事没做完','搞错了，不是没完成，是完成时间说错了'])assert.equal(followupActions(state,text,at+100),null);
});

test('spoken correction retains the bookkeeping habit reference after the phone receives completion and uploads its agenda',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:at});const seed=initial();seed.agenda.tasks.push({...habit,id:'book-roundtrip',title:'记账',time:'23:00'});
 const f=await fixture(seed),original=globalThis.fetch;let step=0;const messages=['今天的记账做完了。','搞错了，其实这件事没做完'];
 globalThis.fetch=async(url)=>String(url).endsWith('/getupdates')?Response.json({msgs:[{from_user_id:'OWNER',message_type:1,message_id:'roundtrip-'+step,context_token:'CTX',item_list:[{voice_item:{text:messages[step++]}}]}]}):Response.json({ret:0});
 try {
  await poll(f.env);let state=await f.read();const agenda=effectiveAgenda(state);
  const request=async(path,body)=>worker.fetch(new Request('https://test.workers.dev'+path,{method:'POST',headers:{Authorization:'Bearer DEVICE'},body:JSON.stringify(body)}),f.env);
  assert.equal((await request('/v1/agenda',{baseVersion:state.agenda.version,tasks:agenda})).status,200);
  assert.equal((await request('/v1/task-commands/receipts',{receipts:state.taskCommands.map(command=>({id:command.id,status:'applied'}))})).status,200);
  state=await f.read();assert.equal(activeFocus(state,at).status,'completed');assert.equal(state.taskCommands.length,0);
  await poll(f.env);state=await f.read();
  assert.deepEqual(state.taskCommands.map(command=>command.action.type),['reopen']);
  const updated=effectiveAgenda(state).find(row=>row.id==='book-roundtrip');
  assert.deepEqual(updated.completedDates,[]);assert.equal(updated.time,'23:00');assert.equal(updated.date,'');assert.equal(updated.recurrence,'daily');
  assert.deepEqual(state.tasks,seed.tasks);assert.deepEqual(effectiveAgenda(state).find(row=>row.id===habit.id),habit);assert.equal(state.bookkeepingDraft,undefined);
 }finally{globalThis.fetch=original}
});
