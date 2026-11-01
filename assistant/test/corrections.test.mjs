import test from 'node:test';
import assert from 'node:assert/strict';
import {applyActions} from '../src/domain.mjs';
import {activeFocus,followupActions,rememberFocus,cleanInterpretation,cleanDraft} from '../src/conversation.mjs';
import worker from '../src/worker.mjs';

const now=Date.parse('2026-11-01T10:40:00+08:00');
const task={id:'wx-test-0',title:'整理厕所资料',date:'2026-11-02',time:'15:00',status:'pending',duration:30,version:1,updatedAt:now,reminderEnabled:false};

test('a bare corrected noun preserves the original task verb and acknowledges the correction',()=>{
 const draft=cleanDraft({items:[{title:task.title,date:task.date,period:'下午'}],question:'下午几点？'},now);
 const result=cleanInterpretation({actions:[{type:'clarify',question:'下午几点？'}],draft:{items:[{title:'测试资料',date:task.date,period:'下午'}],question:'下午几点？'}},now,draft,[task],'测试资料');
 assert.equal(result.draft.items[0].title,'整理测试资料');assert.match(result.actions[0].question,/已更正.*整理测试资料/);
 assert.equal(result.draft.items[0].date,task.date);assert.equal(result.draft.items[0].period,'下午');
 const edit=cleanInterpretation({actions:[{type:'update',query:task.id,title:'测试资料'}]},now,null,[task],'测试资料');
 assert.equal(edit.actions[0].title,'整理测试资料');
 const explicit=cleanInterpretation({actions:[{type:'update',query:task.id,title:'测试资料'}]},now,null,[task],'把整个标题改为测试资料');
 assert.equal(explicit.actions[0].title,'测试资料');
 const newVerb=cleanInterpretation({actions:[{type:'update',query:task.id,title:'提交报告'}]},now,null,[task],'提交报告');
 assert.equal(newVerb.actions[0].title,'提交报告');
 const wrongQuery=cleanInterpretation({actions:[{type:'update',query:'整理测试资料',title:'整理测试资料'}]},now,null,[task],'把整理厕所资料改成整理测试资料');
 assert.equal(wrongQuery.actions[0].query,task.id);
});

test('separate title and time corrections update the same recent task without confirmation',()=>{
 const state={tasks:[task]};rememberFocus(state,[],state.tasks,now);
 const focus=activeFocus(state,now+1000);assert.equal(focus.id,task.id);
 const title=cleanInterpretation({actions:[{type:'update',query:focus.id,title:'整理测试资料',privateNote:'PRIVATE'}]},now+1000);
 const renamed=applyActions(state.tasks,title.actions,now+1000,'title-correction');
 rememberFocus(state,state.tasks,renamed.tasks,now+1000);state.tasks=renamed.tasks;
 const corrected=followupActions(state,'不，4点吧',now+2000);
 const result=applyActions(state.tasks,corrected.actions,now+2000,'time-correction');
 assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].id,task.id);
 assert.equal(result.tasks[0].title,'整理测试资料');assert.equal(result.tasks[0].time,'16:00');
 assert.equal(result.tasks[0].date,task.date);assert.equal(result.tasks[0].duration,30);
 assert.equal(result.tasks[0].reminderEnabled,false);assert.equal(result.tasks[0].version,3);
 assert.match(result.reply,/已更新.*2026-11-02 16:00 整理测试资料/);
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

test('a time answer fills a single afternoon draft and the later message corrects it',()=>{
 const draft=cleanDraft({items:[{title:'整理测试资料',date:'2026-11-02',period:'下午'}],question:'下午几点？'},now);
 const state={tasks:[],scheduleDraft:draft};
 const parsed=followupActions(state,'3点吧',now+1000);assert.equal(parsed.draft,null);
 const first=applyActions([],parsed.actions,now+1000,'first');rememberFocus(state,[],first.tasks,now+1000);
 state.tasks=first.tasks;delete state.scheduleDraft;
 for(const text of ['不，4点吧','三点吧，啊不，下午四点','改到四点半']){
  const next=followupActions(state,text,now+2000);
  assert.equal(next.actions[0].query,first.tasks[0].id);
  assert.equal(next.actions[0].time,text.includes('半')?'16:30':'16:00');
 }
});

test('expired, multiple and ambiguous contexts never guess an update target or time',()=>{
 const state={tasks:[task],scheduleFocus:{id:task.id,updatedAt:now}};
 assert.equal(activeFocus(state,now+15*60000),null);
 assert.equal(followupActions(state,'不，4点吧',now+15*60000),null);
 assert.equal(followupActions({tasks:[task]},'4点吧',now),null);
 assert.equal(followupActions(state,'不是4点',now),null);
 assert.equal(followupActions(state,'4点取快递',now),null);
 assert.equal(followupActions(state,'25点吧',now),null);
 assert.equal(followupActions({...state,scheduleDraft:cleanDraft({items:[{title:'写报告',date:task.date}],question:'几点？'},now)},'4点吧',now),null);
 assert.equal(followupActions({...state,scheduleDraft:cleanDraft({items:[{title:'A',date:task.date,period:'下午'},{title:'B',date:task.date,period:'下午'}],question:'几点？'},now)},'4点吧',now),null);
 const other={...task,id:'wx-other-0'};rememberFocus(state,[],[task,other],now);assert.equal(activeFocus({...state,tasks:[task,other]},now),null);
 const result=applyActions([task,other],[{type:'update',query:task.title,time:'16:00'}],now);
 assert.ok(result.tasks.every(t=>t.time==='15:00'));assert.match(result.reply,/多项/);
});

test('invalid partial corrections cannot damage a task and successful edits reset reminders',()=>{
 for(const fields of [{time:'25:00'},{date:'2026-02-30'},{title:''},{}])assert.throws(()=>cleanInterpretation({actions:[{type:'update',query:task.id,...fields}]}));
 const result=applyActions([{...task,lastReminderAt:now,reminderCount:8}],[{type:'update',query:task.id,time:'16:00'}],now);
 assert.equal(result.tasks[0].lastReminderAt,undefined);assert.equal(result.tasks[0].reminderCount,undefined);
 const invalid=applyActions([task],[{type:'update',query:task.id,time:'25:00'}],now);
 assert.equal(invalid.tasks[0].time,'15:00');assert.equal(invalid.tasks[0].version,1);
});

test('a batch of separate WeChat messages corrects the draft then updates one stored task',async()=>{
 const key=await crypto.subtle.importKey('raw',Buffer.alloc(32,7),'AES-GCM',false,['encrypt','decrypt']);
 const initial={tasks:[],seen:[],outbox:[],cursor:'',owner:'owner',botToken:'TEST_ONLY',settings:{morningTime:'08:00',followupMinutes:30,quietStart:'00:00',quietEnd:'23:59'},scheduleDraft:cleanDraft({items:[{title:task.title,date:task.date,period:'下午'}],question:'下午几点？'})};
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(initial)));
 let row={version:1,ciphertext:JSON.stringify({iv:Buffer.from(iv).toString('base64'),data:Buffer.from(data).toString('base64')})},calls=0,received=false;
 const sent=[],originalFetch=globalThis.fetch;
 const env={STORAGE_KEY:Buffer.alloc(32,7).toString('base64'),
 DB:{prepare(sql){return {args:[],bind(...args){this.args=args;return this},first:async()=>row,async run(){
  if(sql.includes('poll_lease'))return {meta:{changes:1}};
  if(this.args[1]!==row.version)return {meta:{changes:0}};
  row={version:row.version+1,ciphertext:this.args[0]};return {meta:{changes:1}};
 }}}},
 AI:{async run(_model,input){
  calls++;const context=JSON.parse(input.messages.at(-1).content);
  assert.equal(context.message,'测试资料');assert.equal(context.draft.items[0].title,task.title);
  assert.ok(input.messages.some(m=>m.content.includes('直接输出update')));
  return {response:JSON.stringify({actions:[{type:'clarify',question:'已更正为整理测试资料，明天下午几点？'}],draft:{items:[{title:'整理测试资料',date:task.date,period:'下午'}],question:'明天下午几点？'}})};
 }}};
 globalThis.fetch=async(url,options)=>{
  if(String(url).endsWith('/getupdates')){
   const msgs=received?[]:['测试资料','3点吧','不，4点吧'].map((text,index)=>({from_user_id:'owner',message_type:1,message_id:'msg-'+index,context_token:'TEST_CONTEXT',item_list:[{text_item:{text}}]}));received=true;
   return Response.json({msgs,get_updates_buf:'next'});
  }
  assert.ok(String(url).endsWith('/sendmessage'));sent.push(JSON.parse(options.body).msg.item_list[0].text_item.text);return Response.json({ret:0});
 };
 try{
  const waits=[];worker.scheduled({},env,{waitUntil(p){waits.push(p)}});await Promise.all(waits);
  const saved=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(JSON.parse(row.ciphertext).iv,'base64')},key,Buffer.from(JSON.parse(row.ciphertext).data,'base64'))));
  assert.equal(calls,1);assert.equal(saved.tasks.length,1);assert.equal(saved.tasks[0].title,'整理测试资料');assert.equal(saved.tasks[0].time,'16:00');assert.equal(saved.tasks[0].version,2);
  assert.equal(saved.scheduleDraft,undefined);assert.equal(saved.scheduleFocus.id,saved.tasks[0].id);
  assert.equal(saved.seen.length,3);assert.equal(sent.length,3);assert.match(sent.at(-1),/已更新.*16:00 整理测试资料/);
  const again=[];worker.scheduled({},env,{waitUntil(p){again.push(p)}});await Promise.all(again);assert.equal(calls,1);assert.equal(sent.length,3);
 }finally{globalThis.fetch=originalFetch}
});
