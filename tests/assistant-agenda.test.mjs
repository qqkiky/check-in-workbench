import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

test('phone shares only missing agenda fields, skips unchanged uploads and preserves metadata on conflict',async()=>{
 const today=new Date().toISOString().slice(0,10);
 const task=(id,patch={})=>({id,title:id,recurrence:'daily',createdAt:Date.now(),description:'PRIVATE_DESCRIPTION',...patch});
 const state={initialized:true,tasks:[task('habit'),task('weekly',{recurrence:'weekly',weekdays:[1]}),task('dated',{recurrence:'none',scheduledDate:today}),task('timed',{recurrence:'none',scheduledDate:today,scheduledTime:'15:00'}),task('archived',{archivedAt:1})],records:[{taskId:'habit',date:today,note:'PRIVATE_RECORD'}],transactions:[{note:'PRIVATE_LEDGER'}]};
 const values=new Map();globalThis.agendaTest={state,values};
 const modules={
  './appStorage':`export const appStorage={getItem:k=>globalThis.agendaTest.values.get(k),setItem:(k,v)=>globalThis.agendaTest.values.set(k,v)};export const flushPrivateStorage=async()=>{};`,
  '@capacitor/core':`export const Capacitor={getPlatform:()=> 'web'};export const registerPlugin=()=>({});`,
  './storage':`export const storage={};`,
  '@/store':`export const useStore={getState:()=>globalThis.agendaTest.state};`,
  '@/capacitor/task-calendar':`export const syncTasksToCalendar=async()=>{};`,
 };
 const bundle=await build({entryPoints:['src/services/assistant.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'agenda-test',setup(b){b.onResolve({filter:/.*/},a=>modules[a.path]?{path:a.path,namespace:'test'}:null);b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:modules[a.path],loader:'js'}));}}]});
 const {syncAssistantAgenda}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const originalFetch=globalThis.fetch;let uploads=0,conflict=false,last;
 globalThis.fetch=async(url,options)=>{
  if(options.method==='GET'){assert.ok(url.endsWith('/v1/agenda'));return Response.json({version:5})}
  assert.ok(url.endsWith('/v1/agenda'));last=JSON.parse(options.body);uploads++;
  assert.ok(!options.body.includes('PRIVATE'));assert.deepEqual(last.tasks.map(t=>t.id),['dated','habit','weekly']);
  assert.equal(last.tasks.find(t=>t.id==='habit').completed,true);
  return conflict?Response.json({error:'agenda_conflict'},{status:409}):Response.json({version:uploads});
 };
 try{
  const config={url:'https://test.workers.dev',token:'test-token',enabled:true};
  state.initialized=false;await assert.rejects(syncAssistantAgenda(config),/尚未读取/);assert.equal(uploads,0);state.initialized=true;
  await syncAssistantAgenda(config);assert.equal(uploads,1);assert.equal(last.baseVersion,0);
  await syncAssistantAgenda(config);assert.equal(uploads,1);
  state.tasks[0].title='changed';conflict=true;const previous=values.get('wb.assistant.agenda.v1');
  await assert.rejects(syncAssistantAgenda(config),/其他设备/);assert.equal(values.get('wb.assistant.agenda.v1'),previous);
  conflict=false;await syncAssistantAgenda(config);assert.equal(last.baseVersion,1);
  values.set('wb.assistant.agenda.rebase.v1','1');
  await syncAssistantAgenda(config);assert.equal(last.baseVersion,5);assert.equal(values.get('wb.assistant.agenda.rebase.v1'),'0');
 }finally{globalThis.fetch=originalFetch;delete globalThis.agendaTest}
});
