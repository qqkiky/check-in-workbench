import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDraft,cleanInterpretation,activeDraft} from '../src/conversation.mjs';
import worker from '../src/worker.mjs';

test('conversation keeps only structured unfinished schedules and expires after 24 hours',()=>{
 const draft=cleanDraft({items:[{title:'写报告',date:'2026-11-01',period:'下午',raw:'DO_NOT_KEEP',accounts:['PRIVATE']}],question:'明天下午几点？',history:'PRIVATE'},100);
 assert.equal(draft.items[0].period,'下午');assert.ok(!JSON.stringify(draft).includes('PRIVATE'));assert.ok(!JSON.stringify(draft).includes('DO_NOT_KEEP'));
 assert.ok(activeDraft({scheduleDraft:draft},101));assert.equal(activeDraft({scheduleDraft:draft},86400100),null);
});
test('unfinished and malformed model output cannot become a dated task',()=>{
 assert.throws(()=>cleanInterpretation({actions:[{type:'create',title:'写报告',date:'2026-11-01'}]}));
 assert.throws(()=>cleanInterpretation({actions:[{type:'create',title:'写报告',date:'2026-11-01',time:'25:00'}]}));
 assert.throws(()=>cleanInterpretation({actions:[{type:'execute',command:'anything'}]}));
 assert.equal(cleanInterpretation({actions:[{type:'clarify',question:'几点？'}]}).draft,undefined);
 assert.equal(cleanInterpretation({actions:[{type:'create',title:'写报告',date:'2026-11-01',time:'15:00',privateNote:'PRIVATE'}]}).draft,null);
});
test('correcting an uncreated draft creates it once instead of rescheduling a nonexistent task',()=>{
 const draft=cleanDraft({items:[{title:'写报告',date:'2026-11-01',period:'下午'}],question:'几点？'});
 const result=cleanInterpretation({actions:[{type:'reschedule',query:'写报告',date:'2026-11-01',time:'16:00'}],draft:null},Date.now(),draft,[]);
 assert.equal(result.actions[0].type,'create');assert.equal(result.actions[0].title,'写报告');assert.equal(result.draft,null);
 assert.equal(cleanInterpretation({actions:[{type:'list'}],draft:null},Date.now(),draft,[]).draft,undefined);
 const filled={...draft,items:[{title:'写报告',date:'2026-11-01',time:'16:00'}]};
 const corrected=cleanInterpretation({actions:[{type:'complete',query:'写报告'}],draft:filled},Date.now(),draft,[]);
 assert.equal(corrected.actions.length,1);assert.equal(corrected.actions[0].type,'create');assert.equal(corrected.draft,null);
 assert.equal(cleanInterpretation({actions:[{type:'create',title:'取快递',date:'2026-11-01',time:'15:00'}],draft:null},Date.now(),draft,[]).draft,undefined);
});
test('interpretation carries a partial schedule into a short follow-up without writing tasks',async()=>{
 let row=null, calls=0;
 const env={ADMIN_TOKEN:'admin-secret',DEVICE_TOKEN:'device-secret',STORAGE_KEY:Buffer.alloc(32,7).toString('base64'),
 DB:{prepare(){return {args:[],bind(...args){this.args=args;return this},first:async()=>row,async run(){row={version:(row?.version||0)+1,ciphertext:this.args[0]};return {meta:{changes:1}}}}}},
 AI:{async run(_model,input){
  const context=JSON.parse(input.messages.at(-1).content);calls++;
  if(calls===1)return {response:JSON.stringify({actions:[{type:'clarify',question:'明天下午几点写报告？'}],draft:{items:[{title:'写报告',date:'2026-11-01',period:'下午'}],question:'明天下午几点写报告？'}})};
  assert.equal(context.draft.items[0].title,'写报告');assert.equal(context.message,'三点，不对，四点');
  return {response:JSON.stringify({actions:[{type:'create',title:'写报告',date:'2026-11-01',time:'16:00'}],draft:null})};
 }}};
 const interpret=async(body,token='admin-secret')=>worker.fetch(new Request('https://test.workers.dev/admin/interpret',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}),env);
 const first=await (await interpret({text:'嗯，明天写写报告，下午吧'})).json();assert.ok(first.draft);
 const second=await (await interpret({text:'三点，不对，四点',draft:first.draft})).json();assert.equal(second.actions[0].time,'16:00');assert.equal(second.draft,null);
 assert.equal((await interpret({text:'test'},'device-secret')).status,401);
 const schedules=await worker.fetch(new Request('https://test.workers.dev/v1/schedules',{headers:{Authorization:'Bearer device-secret'}}),env);
 assert.deepEqual((await schedules.json()).tasks,[]);
});
