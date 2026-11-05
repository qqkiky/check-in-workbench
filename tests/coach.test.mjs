import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
let serial=0;
async function fixture(){
 const ctx={values:new Map(),state:{initialized:true,tasks:[],records:[],accounts:[],transactions:[],notes:[],transfers:[],acctCategories:[]},calendar:0,platform:'web',requests:[]};
 ctx.state.reload=()=>{ctx.state.tasks=JSON.parse(ctx.values.get('wb.tasks.v1')||'[]')};
 ctx.state.addRecord=record=>ctx.state.records.unshift({...record,id:crypto.randomUUID()});
 ctx.state.deleteRecord=id=>{ctx.state.records=ctx.state.records.filter(row=>row.id!==id)};
 globalThis.coachTest=ctx;
 const modules={
  '@/store':`export const useStore={getState:()=>globalThis.coachTest.state};`,
  './appStorage':`export const appStorage={getItem:k=>globalThis.coachTest.values.get(k),setItem:(k,v)=>globalThis.coachTest.values.set(k,v),removeItem:k=>globalThis.coachTest.values.delete(k)};export const flushPrivateStorage=async()=>{if(globalThis.coachTest.diskError)throw Error('disk failed')};export const saveStorageBatch=async data=>{if(globalThis.coachTest.diskError)throw Error('disk failed');for(const [k,v]of Object.entries(data))globalThis.coachTest.values.set(k,v)};`,
  '@/capacitor/task-calendar':`export const isCalendarSyncEnabled=()=>true;export const syncTasksToCalendar=async()=>{globalThis.coachTest.calendar++};`,
  '@capacitor/core':`export const Capacitor={getPlatform:()=>globalThis.coachTest.platform};export const registerPlugin=()=>({request:options=>globalThis.coachTest.native(options),status:async()=>({granted:true,exact:true}),sync:async data=>globalThis.coachTest.requests.push(data)});`,
 };
 const bundle=await build({stdin:{contents:"export * from './src/services/coach.ts';export * from './src/services/coachReminders.ts';export * from './src/services/agent.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'coach-test',setup(b){b.onResolve({filter:/.*/},a=>modules[a.path]?{path:a.path,namespace:'test'}:null);b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:modules[a.path],loader:'js'}));}}]});
 const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')+'#'+(++serial));
 return {ctx,api};
}
const date=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
test('inferred memory remains unconfirmed, can be accepted once, edited and removed without retaining it in new model context',async()=>{
 const {ctx,api}=await fixture();
 await api.proposeCoach({action:'suggest_memory',kind:'goal',content:'睡前读书减少刷手机'});
 assert.equal(api.readMemories().length,0);assert.ok(!api.coachContext('帮我安排目标').includes('睡前读书'));
 const proposal=api.readProposals()[0];await api.acceptProposal(proposal.id);
 assert.equal(api.readMemories().length,1);assert.ok(api.coachContext('帮我安排目标').includes('睡前读书'));
 await assert.rejects(api.acceptProposal(proposal.id),/已处理/);
 const row=api.readMemories()[0];await api.saveMemory({...row,content:'每天阅读十页'});
 assert.ok(!api.coachContext('安排目标').includes('睡前读书'));
 await api.deleteMemory(row.id);assert.ok(!api.coachContext('安排目标').includes('每天阅读十页'));assert.equal(ctx.state.tasks.length,0);
});
test('plans validate every item before saving, require adoption, preserve existing tasks and survive a replay without duplicates',async()=>{
 const {ctx,api}=await fixture();ctx.state.tasks=[{id:'keep',title:'保留原事项',recurrence:'none',createdAt:1,updatedAt:1,categoryId:'life'}];
 await assert.rejects(api.proposeCoach({action:'suggest_plan',title:'阅读计划',items:[{title:'阅读',date:date(),time:'20:00'},{title:'错误事项',date:'2026-02-30'}]}),/日期/);
 assert.equal(api.readProposals().length,0);assert.equal(ctx.state.tasks.length,1);
 await api.proposeCoach({action:'suggest_plan',title:'阅读计划',items:[{title:'阅读十页',date:date(),time:'20:00',recurrence:'daily'},{title:'挑一本书'}]});
 const proposal=api.readProposals()[0];assert.equal(ctx.state.tasks.length,1);
 await api.acceptProposal(proposal.id);assert.equal(ctx.state.tasks.length,3);assert.equal(ctx.calendar,1);
 assert.ok(ctx.state.tasks.some(row=>row.id==='keep'));assert.equal(ctx.state.tasks.find(row=>row.title==='挑一本书').scheduledTime,undefined);
 ctx.values.set('wb.assistant.coach.proposals.v1',JSON.stringify([proposal]));await api.acceptProposal(proposal.id);assert.equal(ctx.state.tasks.length,3);
});
test('disk failure cannot report a plan adopted or change the in-memory task list',async()=>{
 const {ctx,api}=await fixture();await api.proposeCoach({action:'suggest_plan',items:[{title:'读书'}]});
 const id=api.readProposals()[0].id;ctx.diskError=true;await assert.rejects(api.acceptProposal(id),/disk failed/);
 assert.equal(ctx.state.tasks.length,0);assert.equal(api.readProposals().length,1);
});
test('current local completions drive pending queries, and an immediate pronoun undo changes only the referenced occurrence without an API call',async()=>{
 const {ctx,api}=await fixture(),day=date(),config={url:'https://test.example/v1',key:'SECRET',model:'test'};
 const task={id:'read',title:'记账',recurrence:'daily',scheduledTime:'23:00',categoryId:'life',createdAt:1,updatedAt:1};
 ctx.state.tasks=[task,{...task,id:'other',title:'其他事项'}];ctx.state.records=[{id:'other-record',taskId:'other',date:day,completedAt:Date.now()}];
 api.rememberOperation(ctx.state.tasks,{action:'complete_task',query:'read',date:day});
 ctx.state.records.push({id:'read-record',taskId:'read',date:day,completedAt:Date.now()});
 const before=JSON.stringify(ctx.state.tasks),original=globalThis.fetch;globalThis.fetch=()=>{throw Error('should stay local')};
 try {
  const remaining=await api.chatWithAgent(config,{messages:[],entries:[]},'今天还有什么待办');
  assert.ok(!remaining.entries.at(-1).results[0].text.includes('记账'));
  const history=await api.chatWithAgent(config,remaining,'搞错了，其实这件事没做完');
  assert.equal(ctx.state.records.length,1);assert.equal(ctx.state.records[0].id,'other-record');assert.equal(JSON.stringify(ctx.state.tasks),before);
  assert.match(history.entries.at(-1).results[0].text,/已恢复待办/);
 }finally{globalThis.fetch=original}
});
test('manual reschedules are facts in coach context; unchanged reloads and private remarks are not logged',async()=>{
 const {api}=await fixture(),before=[{id:'read',title:'阅读',scheduledDate:'2026-11-05',scheduledTime:'20:00',description:'PRIVATE',recurrence:'none'}];
 api.observeScheduleChanges(before,before.map(task=>({...task})));assert.ok(!api.coachContext('安排').includes('阅读'));
 api.observeScheduleChanges(before,before.map(task=>({...task,scheduledDate:'2026-11-06'})));
 const context=api.coachContext('安排');assert.ok(context.includes('阅读'));assert.ok(context.includes('2026-11-06'));assert.ok(!context.includes('PRIVATE'));
});
test('notification schedules exclude completed, deleted and untimed tasks, and updates use current times without cloud or private notes',async()=>{
 const {ctx,api}=await fixture(),day=date();ctx.values.set('wb.coach.reminders.v1',JSON.stringify({enabled:true}));
 const base={id:'read',title:'阅读',scheduledDate:day,scheduledTime:'20:00',recurrence:'none',description:'PRIVATE',createdAt:1};
 ctx.state.tasks=[base,{...base,id:'done'},{...base,id:'deleted',archivedAt:1},{...base,id:'untimed',scheduledTime:undefined}];ctx.state.records=[{taskId:'done',date:day,completedAt:Date.now()}];
 const now=new Date(day+'T19:00:00'),events=api.reminderEvents(now);assert.equal(events.length,1);assert.ok(!JSON.stringify(events).includes('PRIVATE'));
 ctx.state.tasks[0]={...base,scheduledTime:'21:00'};assert.equal(new Date(api.reminderEvents(now)[0].at).getHours(),21);
 ctx.values.set('wb.coach.reminders.v1',JSON.stringify({enabled:false}));assert.deepEqual(api.reminderEvents(now),[]);
});
test('model memory proposals remain local drafts, tool status is truthful, and rejection updates future chat history',async()=>{
 const {ctx,api}=await fixture();ctx.platform='android';
 const config={url:'https://test.example',key:'SECRET',model:'test'};ctx.values.set('wb.assistant.agent.connection.v1',JSON.stringify(config));
 ctx.native=async options=>{ctx.requests.push(options);return {choices:[{message:{tool_calls:[{id:'proposal-call',type:'function',function:{name:'coach',arguments:JSON.stringify({action:'suggest_memory',kind:'routine',content:'每天晚上读书'})}}]}}]}};
 const history=await api.chatWithAgent(config,{messages:[],entries:[]},'记住我每天晚上读书');
 assert.equal(api.readMemories().length,0);assert.equal(ctx.requests.length,1);assert.match(history.entries.at(-1).results[0].text,/尚未记住/);
 await api.dismissProposal(api.readProposals()[0].id);
 assert.match(api.readAgentHistory().messages.find(row=>row.tool_call_id==='proposal-call').content,/未采纳/);
});

test('a future-start habit in an adopted plan has no reminders before its confirmed start date',async()=>{
 const {ctx,api}=await fixture();const start=new Date();start.setDate(start.getDate()+3);
 const day=start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0')+'-'+String(start.getDate()).padStart(2,'0');
 await api.proposeCoach({action:'suggest_plan',items:[{title:'未来开始阅读',date:day,time:'20:00',recurrence:'daily'}]});
 await api.acceptProposal(api.readProposals()[0].id);ctx.values.set('wb.coach.reminders.v1',JSON.stringify({enabled:true}));
 const events=api.reminderEvents(new Date(date()+'T08:00:00'));assert.ok(events.length>0);assert.ok(events.every(event=>event.date>=day));
});
