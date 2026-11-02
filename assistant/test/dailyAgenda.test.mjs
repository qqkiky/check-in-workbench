import test from 'node:test';
import assert from 'node:assert/strict';
import {safeAgenda,dailyPending,agendaLines} from '../src/dailyAgenda.mjs';
import worker from '../src/worker.mjs';

const now=Date.parse('2026-11-02T08:05:00+08:00');
const rule=(id,patch={})=>({id,title:id,date:'',time:'09:00',createdDate:'2026-10-01',recurrence:'daily',weekdays:[],monthDay:0,excludedDates:[],completedDates:[],completed:false,...patch});
const schedules=[{id:'single',title:'当日日程',date:'2026-11-02',time:'10:00',status:'pending'},
 {id:'old',title:'不带逾期',date:'2026-11-01',time:'10:00',status:'pending'},
 {id:'future',title:'不提前',date:'2026-11-04',time:'10:00',status:'pending'},
 {id:'done',title:'不带已完成',date:'2026-11-02',time:'10:00',status:'completed'}];
const rules=safeAgenda([rule('daily'),rule('monday',{recurrence:'weekly',weekdays:[1]}),rule('sunday',{recurrence:'weekly',weekdays:[0]}),
 rule('monthly',{recurrence:'monthly',monthDay:2}),rule('month-end',{recurrence:'monthly',monthDay:31}),
 rule('excluded',{excludedDates:['2026-11-02']}),rule('checked',{completedDates:['2026-11-02']}),
 rule('untimed',{recurrence:'none',date:'2026-11-02',time:''}),rule('quick',{recurrence:'none',time:''}),rule('quick-done',{recurrence:'none',time:'',completed:true})]);

test('morning agenda includes current habits and untimed todos, never overdue/future/completed items',()=>{
 const rows=dailyPending(schedules,rules,'2026-11-02');
 assert.deepEqual(rows.map(row=>row.id).sort(),['daily','monday','monthly','quick','single','untimed']);
 assert.match(agendaLines(rows),/时间未定 untimed/);assert.equal(rows.at(-1).time,'');
 assert.deepEqual(dailyPending(schedules,rules,'2026-11-03').map(row=>row.id).sort(),['checked','daily','excluded','quick']);
 const feb=safeAgenda([rule('end',{recurrence:'monthly',monthDay:31})]);assert.deepEqual(dailyPending([],feb,'2027-02-28'),[]);
});
test('agenda rejects malformed repeats and strips private fields before storing or displaying',()=>{
 const clean=safeAgenda([rule('private',{description:'PRIVATE_NOTE',accounts:[{balance:1}],note:'PRIVATE_RECORD'})]);
 assert.ok(!JSON.stringify(clean).includes('PRIVATE'));assert.equal(clean[0].accounts,undefined);
 for(const patch of [{weekdays:[8]},{monthDay:32},{recurrence:'monthly',monthDay:0},{excludedDates:['2026-02-30']},{date:'tomorrow'},{time:'25:00'}])assert.throws(()=>safeAgenda([rule('bad',patch)]));
 assert.throws(()=>safeAgenda([rule('duplicate'),rule('duplicate')]));
});
test('scheduled WeChat digest and today query include habits without another phone upload',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now});
 const key=await crypto.subtle.importKey('raw',Buffer.alloc(32,7),'AES-GCM',false,['encrypt','decrypt']);
 const initial={tasks:schedules.map(task=>({...task,version:1,updatedAt:now})),agenda:{version:1,tasks:rules},seen:[],outbox:[],cursor:'',owner:'owner',botToken:'TEST_ONLY',contextToken:'TEST_CONTEXT',settings:{morningTime:'08:00',followupMinutes:30,quietStart:'00:00',quietEnd:'23:59'}};
 const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(initial)));
 let row={version:1,ciphertext:JSON.stringify({iv:Buffer.from(iv).toString('base64'),data:Buffer.from(data).toString('base64')})},query=false;
 const env={STORAGE_KEY:Buffer.alloc(32,7).toString('base64'),DB:{prepare(sql){return {args:[],bind(...args){this.args=args;return this},first:async()=>row,async run(){
  if(sql.includes('poll_lease'))return {meta:{changes:1}};
  if(this.args[1]!==row.version)return {meta:{changes:0}};
  row={version:row.version+1,ciphertext:this.args[0]};return {meta:{changes:1}};
 }}}}};
 const sent=[],originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  if(String(url).endsWith('/getupdates')){const msgs=query?[{from_user_id:'owner',message_type:1,message_id:'query',item_list:[{text_item:{text:'今天的安排'}}]}]:[];query=false;return Response.json({msgs,get_updates_buf:'next'});}
  assert.ok(String(url).endsWith('/sendmessage'));sent.push(JSON.parse(options.body).msg.item_list[0].text_item.text);return Response.json({ret:0});
 };
 const poll=async()=>{const waits=[];worker.scheduled({},env,{waitUntil(p){waits.push(p)}});await Promise.all(waits)};
 try{
  await poll();assert.equal(sent.length,1);assert.match(sent[0],/今天有 6 项待办/);
  for(const title of ['daily','monday','monthly','quick','untimed','当日日程'])assert.ok(sent[0].includes(title));
  for(const title of ['不带逾期','不提前','不带已完成','sunday','month-end','excluded','checked','quick-done'])assert.ok(!sent[0].includes(title));
  await poll();assert.equal(sent.length,1);
  query=true;await poll();assert.equal(sent.length,2);assert.match(sent[1],/未完成安排（6项）/);
  t.mock.timers.setTime(Date.parse('2026-11-03T08:05:00+08:00'));await poll();assert.equal(sent.length,3);assert.match(sent[2],/今天有 4 项待办/);assert.ok(!sent[2].includes('monday'));
 }finally{globalThis.fetch=originalFetch}
});
