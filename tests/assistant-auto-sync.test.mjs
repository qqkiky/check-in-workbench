import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const config={url:'https://test.workers.dev',token:'test-token',enabled:true};
const at=Date.parse('2026-11-04T10:00:00+08:00'),day='2026-11-04';
const modules={
 './appStorage':`export const appStorage={getItem:k=>globalThis.autoSyncTest.values.get(k),setItem:(k,v)=>globalThis.autoSyncTest.values.set(k,v)};export const flushPrivateStorage=async()=>{};`,
 '@capacitor/core':`export const Capacitor={getPlatform:()=> 'web'};export const registerPlugin=()=>({});`,
 './storage':`export const storage={setTasks:v=>globalThis.autoSyncTest.diskTasks=structuredClone(v),setRecords:v=>globalThis.autoSyncTest.diskRecords=structuredClone(v)};`,
 '@/store':`export const useStore={getState:()=>globalThis.autoSyncTest.state,subscribe:fn=>globalThis.autoSyncTest.listeners.add(fn)};`,
 '@/capacitor/task-calendar':`export const syncTasksToCalendar=async()=>{if(globalThis.autoSyncTest.calendarError)throw Error('calendar offline')};`,
};
const bundle=await build({entryPoints:['src/services/assistant.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'auto-sync-test',setup(b){b.onResolve({filter:/.*/},a=>modules[a.path]?{path:a.path,namespace:'test'}:null);b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:modules[a.path],loader:'js'}));}}]});
const drain=async()=>{for(let i=0;i<100;i++)await Promise.resolve()};
let instance=0;
async function fixture(t){
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:at});
 const originals={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document};
 const ctx={values:new Map([['wb.assistant.connection.v1',JSON.stringify(config)]]),listeners:new Set(),cloud:[],agenda:[],gets:0,posts:0,hold:null};
 ctx.diskTasks=[{id:'single',title:'single',recurrence:'none',scheduledDate:day,scheduledTime:'11:00',createdAt:at,updatedAt:at},{id:'habit',title:'habit',recurrence:'daily',scheduledTime:'12:00',createdAt:at,updatedAt:at}];ctx.diskRecords=[];
 ctx.emit=()=>ctx.listeners.forEach(fn=>fn());
 ctx.state={initialized:true,tasks:structuredClone(ctx.diskTasks),records:[],transactions:[],transfers:[],accounts:[],acctCategories:[],reload(){ctx.state.tasks=structuredClone(ctx.diskTasks);ctx.state.records=structuredClone(ctx.diskRecords);ctx.emit()}};
 ctx.complete=()=>{ctx.diskRecords=ctx.diskTasks.map(task=>({id:'done-'+task.id,taskId:task.id,date:day,completedAt:at,taskTitle:task.title}));ctx.state.records=structuredClone(ctx.diskRecords);ctx.emit()};
 globalThis.autoSyncTest=ctx;globalThis.window=new EventTarget();globalThis.document=new EventTarget();document.visibilityState='visible';
 globalThis.fetch=async(url,options)=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;
  if(path==='/v1/task-commands')return Response.json({items:[]});
  if(path==='/v1/bookkeeping'){if(ctx.financeError)throw Error('finance offline');return Response.json({items:[]})}
  if(path==='/v1/schedules'){
   if(body){ctx.posts++;const accepted=body.tasks.map(task=>({...task,version:(ctx.cloud.find(row=>row.id===task.id)?.version||0)+1,updatedAt:at}));for(const task of accepted){ctx.cloud=ctx.cloud.filter(row=>row.id!==task.id);ctx.cloud.push(task)}return Response.json({accepted,conflicts:[]})}
   ctx.gets++;const snapshot=structuredClone(ctx.cloud);if(ctx.hold)await ctx.hold;return Response.json({tasks:snapshot,connected:true});
  }
  if(path==='/v1/agenda'){if(body){ctx.agenda=body.tasks;return Response.json({version:body.baseVersion+1})}return Response.json({version:0})}
  throw Error('unexpected path '+path);
 };
 t.after(()=>{Object.assign(globalThis,originals);delete globalThis.autoSyncTest});
 ctx.api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')+'#'+(++instance));
 return ctx;
}

test('completion during a manual in-flight sync is automatically retried without overwriting phone records or looping on reload',async(t)=>{
 const ctx=await fixture(t);let release;ctx.hold=new Promise(resolve=>release=resolve);
 ctx.api.initAssistantSync();const running=ctx.api.syncAssistant();await drain();assert.equal(ctx.gets,1);
 ctx.complete();t.mock.timers.tick(2000);await drain();ctx.hold=null;release();await running;await drain();
 t.mock.timers.tick(2000);await drain();
 assert.equal(ctx.cloud.find(row=>row.id==='single').status,'completed');
 assert.ok(ctx.agenda.find(row=>row.id==='habit').completedDates.includes(day));
 assert.equal(ctx.state.records.length,2);const gets=ctx.gets;
 t.mock.timers.tick(10000);await drain();assert.equal(ctx.gets,gets);
});

test('switching straight to WeChat flushes the pending completion instead of waiting for a foreground timer',async(t)=>{
 const ctx=await fixture(t);ctx.api.initAssistantSync();t.mock.timers.tick(2000);await drain();
 ctx.complete();document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));await drain();
 assert.equal(ctx.cloud.find(row=>row.id==='single').status,'completed');
 assert.ok(ctx.agenda.find(row=>row.id==='habit').completedDates.includes(day));assert.equal(ctx.state.records.length,2);
});

test('a bookkeeping failure cannot block publishing the completed habit to WeChat',async(t)=>{
 const ctx=await fixture(t);ctx.complete();ctx.financeError=true;
 await assert.rejects(ctx.api.syncAssistant(),/finance offline/);
 assert.equal(ctx.cloud.find(row=>row.id==='single').status,'completed');
 assert.ok(ctx.agenda.find(row=>row.id==='habit')?.completedDates.includes(day));
});

test('a calendar failure cannot block publishing the completed habit to WeChat',async(t)=>{
 const ctx=await fixture(t);ctx.complete();ctx.calendarError=true;
 await assert.rejects(ctx.api.syncAssistant(),/calendar offline/);
 assert.equal(ctx.cloud.find(row=>row.id==='single').status,'completed');
 assert.ok(ctx.agenda.find(row=>row.id==='habit')?.completedDates.includes(day));
});

test('completion queued during a full-data sync runs after the lock is released',async(t)=>{
 const ctx=await fixture(t);ctx.api.initAssistantSync();const release=ctx.api.lockAssistantForDataSync();
 ctx.complete();t.mock.timers.tick(2000);await drain();assert.equal(ctx.gets,0);
 release();t.mock.timers.tick(2000);await drain();
 assert.equal(ctx.cloud.find(row=>row.id==='single').status,'completed');
 assert.ok(ctx.agenda.find(row=>row.id==='habit').completedDates.includes(day));
});

test('reconnecting retries completion after an offline attempt and disabled sync sends nothing',async(t)=>{
 const ctx=await fixture(t),fetch=globalThis.fetch;let offline=true;
 globalThis.fetch=async(...args)=>{if(offline)throw Error('offline');return fetch(...args)};
 ctx.api.initAssistantSync();ctx.complete();t.mock.timers.tick(2000);await drain();
 assert.equal(ctx.state.records.length,2);assert.equal(ctx.cloud.length,0);
 offline=false;window.dispatchEvent(new Event('online'));t.mock.timers.tick(2000);await drain();
 assert.equal(ctx.cloud.find(row=>row.id==='single').status,'completed');assert.ok(ctx.agenda.find(row=>row.id==='habit').completedDates.includes(day));
 ctx.values.set('wb.assistant.connection.v1',JSON.stringify({...config,enabled:false}));
 const gets=ctx.gets;ctx.diskRecords=[];ctx.state.records=[];ctx.emit();document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));t.mock.timers.tick(2000);await drain();
 assert.equal(ctx.gets,gets);
});
