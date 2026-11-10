import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function fixture(tasks=[]){
 const f={state:{tasks,records:[],initialized:true},savedTasks:tasks,savedRecords:[],permission:'granted',calls:[],deleted:[],changes:[],newEvents:[],removed:0};globalThis.calendarSyncTest=f;
 f.state.reload=()=>{f.state.tasks=f.savedTasks;f.state.records=f.savedRecords};
 f.native={checkPermissions:async()=>({calendar:f.permission}),reconcile:async options=>{f.calls.push(['reconcile',options]);if(f.nativeFailure)throw Error('provider unavailable');return {removed:f.removed,deletedKeys:f.deleted,changes:f.changes,newEvents:f.newEvents}},rebind:async options=>{f.calls.push(['rebind',options])},syncAll:async options=>{f.calls.push(['upsert',options]);return {synced:options.tasks.length,removed:f.pruned||0}},removeTask:async options=>{f.calls.push(['remove',options]);return {removed:1}}};
 const modules={
  '@capacitor/core':`export const Capacitor={getPlatform:()=> 'android'};export const registerPlugin=()=>Object.fromEntries(['checkPermissions','reconcile','rebind','syncAll','removeTask'].map(key=>[key,(...args)=>globalThis.calendarSyncTest.native[key](...args)]));`,
  '@/services/storage':`export const storage={setTasks:tasks=>globalThis.calendarSyncTest.savedTasks=tasks,setRecords:records=>globalThis.calendarSyncTest.savedRecords=records};`,
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
test('new selected-calendar events are saved before writing back and replay never duplicates tasks',async()=>{
 const {f,service:s}=await fixture();
 f.newEvents=[{key:'sys-test-100@2026-11-02',eventId:100,title:'小爱新增事项',startMillis:new Date('2026-11-02T15:00:00').getTime(),endMillis:new Date('2026-11-02T15:30:00').getTime(),isNew:true}];
 await s.syncCalendarWithCleanup();assert.equal(f.state.tasks.length,1);assert.equal(f.savedTasks[0].title,'小爱新增事项');assert.equal(f.calls.at(-1)[1].tasks[0].taskId,'sys-test-100@2026-11-02');
 await s.syncCalendarWithCleanup();assert.equal(f.state.tasks.length,1);
 f.newEvents=[];f.changes=[{...f.state.tasks[0],key:'sys-test-100@2026-11-02',eventId:100,title:'在日历中改名',startMillis:new Date('2026-11-03T16:00:00').getTime(),endMillis:new Date('2026-11-03T16:30:00').getTime()}];
 await s.syncCalendarWithCleanup();assert.equal(f.state.tasks[0].title,'在日历中改名');assert.equal(f.state.tasks[0].scheduledDate,'2026-11-03');assert.ok(f.calls.some(([name])=>name==='rebind'));
});


test('a daily task edited to weekly sends only new occurrences and scopes cleanup to that task',async()=>{
 const weekday=(new Date().getDay()+1)%7;
 const updated=task('habit',{recurrence:'weekly',weekdays:[weekday],scheduledDate:undefined});
 const {f,service:s}=await fixture([updated,task('other',{recurrence:'daily'})]);
 await s.syncTaskToCalendar(updated,[]);
 const [,plan]=f.calls.find(([name])=>name==='upsert');
 assert.deepEqual(plan.plannedTaskIds,['habit']);
 assert.match(plan.fromDate,/^\d{4}-\d{2}-\d{2}$/);
 assert.equal(plan.tasks.length,2);
 assert.ok(plan.tasks.every(event=>event.taskId.startsWith('habit@')&&new Date(event.startMillis).getDay()===weekday));
});

test('cleanup still runs if the task has no events in the next fourteen days',async()=>{
 const updated=task('habit',{recurrence:'weekly',weekdays:[1],scheduledDate:'2099-01-01'});
 const {f,service:s}=await fixture([updated]);f.pruned=3;
 const report=await s.syncCalendarWithCleanup();
 const [,plan]=f.calls.find(([name])=>name==='upsert');
 assert.deepEqual(plan.tasks,[]);assert.deepEqual(plan.plannedTaskIds,['habit']);
 assert.equal(report.removed,3);assert.equal(report.synced,0);
});
