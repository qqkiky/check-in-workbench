import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/services/calendarDeletion';export * from './src/services/calendarPlan';export * from './src/utils/recurrence';export * from './src/services/todayAgenda';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {planCalendarDeletions,buildCalendarEvents,taskOccursOnDate,buildTodayAgenda}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const task=(id,patch={})=>({id,title:id,categoryId:'life',recurrence:'none',scheduledDate:'2026-11-02',scheduledTime:'09:00',createdAt:1,updatedAt:1,...patch});
test('calendar deletion removes only its matching one-off task and never unrelated data',()=>{
 const tasks=[task('one'),task('other')];const result=planCalendarDeletions(tasks,['one@2026-11-02','foreign@2026-11-02','one@2026-11-02'],100);
 assert.deepEqual(result.removedIds,['one']);assert.deepEqual(result.tasks,[tasks[1]]);assert.equal(tasks.length,2);
 assert.equal(planCalendarDeletions(result.tasks,['one@2026-11-02'],101).changed,false);
});
test('deleting one day of a habit cancels only that occurrence across calendar, day and reminder selectors',()=>{
 const habit=task('habit',{recurrence:'daily'}),plan=planCalendarDeletions([habit],['habit@2026-11-02'],100),updated=plan.tasks[0];
 assert.equal(plan.cancelledOccurrences,1);assert.equal(updated.id,habit.id);assert.equal(updated.recurrence,'daily');assert.deepEqual(updated.excludedDates,['2026-11-02']);
 const day=new Date('2026-11-02T12:00:00'),tomorrow=new Date('2026-11-03T12:00:00');
 assert.equal(taskOccursOnDate(updated,day),false);assert.equal(taskOccursOnDate(updated,tomorrow),true);assert.equal(buildTodayAgenda([updated],[],day,day).rows.length,0);
 const events=buildCalendarEvents(updated,[{taskId:'habit',date:'2026-11-02',completedAt:100}],day);assert.ok(!events.some(event=>event.taskId==='habit@2026-11-02'));assert.ok(events.some(event=>event.taskId==='habit@2026-11-03'));
 assert.equal(planCalendarDeletions([updated],['habit@2026-11-02'],101).changed,false);
});
test('malformed recurrence keys cannot cancel every day or create invalid exceptions',()=>{
 const t=task('habit',{recurrence:'weekly',weekdays:[1]});
 for(const key of ['habit','habit@2026-02-30','habit@invalid'])assert.equal(planCalendarDeletions([t],[key]).changed,false);
});
test('a deletion of an old date cannot delete a one-off task explicitly rescheduled to a new date',()=>{
 const t=task('one',{scheduledDate:'2026-11-03'});assert.equal(planCalendarDeletions([t],['one@2026-11-02']).changed,false);assert.equal(planCalendarDeletions([t],['one@2026-11-03']).removedIds[0],'one');
});
