import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/services/calendarUpdates';export * from './src/services/calendarPlan';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {planCalendarUpdates,buildCalendarEvents}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const task={id:'one',title:'original',recurrence:'none',scheduledDate:'2026-11-02',scheduledTime:'09:00',categoryId:'work',createdAt:1,updatedAt:1};
const change={key:'one@2026-11-02',eventId:100,title:'calendar title',startMillis:new Date('2026-11-03T15:00:00').getTime(),endMillis:new Date('2026-11-03T15:30:00').getTime()};
test('calendar text and time edits preserve task identity and reuse the existing calendar row',()=>{
 const result=planCalendarUpdates([task],[],[change]);assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].id,'one');assert.equal(result.tasks[0].title,'calendar title');assert.equal(result.tasks[0].scheduledTime,'15:00');assert.equal(result.tasks[0].scheduledDate,'2026-11-03');assert.deepEqual(result.rebindings,[{fromKey:change.key,toKey:'one@2026-11-03',eventId:100}]);
 assert.equal(planCalendarUpdates([task],[],[change],new Set(['one'])).changed,0);
});
test('editing one habit occurrence preserves later habits and existing completion details',()=>{
 const habit={...task,recurrence:'daily'},record={id:'record',taskId:'one',date:'2026-11-02',completedAt:1,note:'keep',progress:4};
 const result=planCalendarUpdates([habit],[record],[{...change,title:'✅ 已完成｜changed habit'}]);
 assert.equal(result.tasks.length,2);assert.deepEqual(result.tasks.find(t=>t.id==='one').excludedDates,['2026-11-02']);
 const exception=result.tasks.find(t=>t.id!=='one');assert.equal(exception.recurrence,'none');assert.equal(exception.title,'changed habit');
 assert.equal(result.records[0].id,'record');assert.equal(result.records[0].taskId,exception.id);assert.equal(result.records[0].note,'keep');assert.equal(result.records[0].progress,4);
});
test('all-day imports keep their calendar date and no invented clock time',()=>{
 const start=Date.parse('2026-11-03T00:00:00Z');
 const result=planCalendarUpdates([],[],[{key:'sys-test-100@2026-11-03',eventId:100,title:'全天事项',startMillis:start,endMillis:start+86400000,allDay:true,isNew:true}]);
 assert.equal(result.tasks[0].scheduledDate,'2026-11-03');assert.equal(result.tasks[0].scheduledTime,undefined);assert.equal(result.tasks[0].calendarAllDay,true);
 const [event]=buildCalendarEvents(result.tasks[0],[]);assert.equal(event.allDay,true);assert.equal(event.startMillis,start);assert.equal(event.endMillis,start+86400000);
});
