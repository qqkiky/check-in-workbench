import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function fixture(tasks=[]){
 const f={state:{tasks,records:[],initialized:true},permission:'granted',calls:[],deleted:[],removed:0};globalThis.calendarSyncTest=f;
 f.native={checkPermissions:async()=>({calendar:f.permission}),reconcile:async options=>{f.calls.push(['reconcile',options]);if(f.nativeFailure)throw Error('provider unavailable');return {removed:f.removed,deletedKeys:f.deleted}},syncAll:async options=>{f.calls.push(['upsert',options]);return {synced:options.tasks.length}},removeTask:async options=>{f.calls.push(['remove',options]);return {removed:1}}};
 const modules={
  '@capacitor/core':`export const Capacitor={getPlatform:()=> 'android'};export const registerPlugin=()=>Object.fromEntries(['checkPermissions','reconcile','syncAll','removeTask'].map(key=>[key,(...args)=>globalThis.calendarSyncTest.native[key](...args)]));`,
  '@/store':`export const useStore={getState:()=>globalThis.calendarSyncTest.state};`,
  '@/services/appStorage':`export const appStorage={getItem:()=> '1'};export const flushPrivateStorage=async()=>{if(globalThis.calendarSyncTest.diskFailure)throw Error('disk error')};`,
 };
 const bundle=await build({stdin:{contents:"export * from './src/capacitor/task-calendar';export * from './src/services/calendarDeletion';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'calendar-native-test',setup(b){b.onResolve({filter:/.*/},a=>modules[a.path]?{path:a.path,namespace:'mock'}:null);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:modules[a.path],loader:'js'}));}}]});
 const service=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 f.state.applyCalendarDeletions=keys=>{const plan=service.planCalendarDeletions(f.state.tasks,keys);f.state.tasks=plan.tasks;return {deletedTasks:plan.removedIds.length,cancelledOccurrences:plan.cancelledOccurrences}};
 return {f,service};
}
const task=(id,patch={})=>({id,title:id,recurrence:'none',scheduledDate:'2026-11-02',scheduledTime:'09:00',categoryId:'work',createdAt:1,updatedAt:1,...patch});
test('an empty full snapshot still cleans tracked calendar residue',async()=>{
 const {f,service:s}=await fixture();f.removed=2;const report=await s.syncCalendarWithCleanup();
 assert.equal(report.removed,2);assert.equal(report.synced,0);assert.deepEqual(f.calls,[['reconcile',{fullSnapshot:true,activeTaskIds:[]}]]);
});
test('partial task updates never prune unrelated calendars or recreate a deleted occurrence',async()=>{
 const {f,service:s}=await fixture([task('one'),task('habit',{recurrence:'daily'})]);f.deleted=['habit@2026-11-02'];
 await s.syncTaskToCalendar(f.state.tasks[0],[]);assert.equal(f.calls[0][1].fullSnapshot,false);assert.ok(f.calls[0][1].activeTaskIds.includes('habit'));
 assert.deepEqual(f.state.tasks[1].excludedDates,['2026-11-02']);assert.ok(f.calls.filter(([name])=>name==='upsert').every(([,options])=>options.tasks.every(event=>event.taskId.startsWith('one@'))));
});
test('calendar deletions are persisted before writing and do not alter completion history',async()=>{
 const {f,service:s}=await fixture([task('one'),task('habit',{recurrence:'daily'})]);f.state.records=[{id:'history',taskId:'one',date:'2026-11-02',completedAt:1}];f.deleted=['one@2026-11-02','habit@2026-11-02'];
 const report=await s.syncCalendarWithCleanup();assert.equal(report.deletedTasks,1);assert.equal(report.cancelledOccurrences,1);assert.equal(f.state.records[0].id,'history');
 const written=f.calls.filter(([name])=>name==='upsert').flatMap(([,options])=>options.tasks);assert.ok(written.length>0);assert.ok(written.every(event=>event.taskId!=='one@2026-11-02'&&event.taskId!=='habit@2026-11-02'));
});
test('permission, provider and uninitialized-state failures never become task deletions',async()=>{
 const {f,service:s}=await fixture([task('one')]);f.deleted=['one@2026-11-02'];f.permission='denied';await assert.rejects(s.syncCalendarWithCleanup(),/权限/);assert.equal(f.state.tasks.length,1);
 f.permission='granted';f.nativeFailure=true;await assert.rejects(s.syncCalendarWithCleanup(),/unavailable/);assert.equal(f.state.tasks.length,1);
 f.nativeFailure=false;f.state.initialized=false;await assert.rejects(s.syncCalendarWithCleanup(),/加载/);assert.equal(f.state.tasks.length,1);
});
