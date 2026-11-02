import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/services/todayAgenda.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {buildTodayAgenda,habitBackground}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const now=new Date('2026-11-01T19:12:00'),task=(id,patch={})=>({id,title:id,categoryId:'life',recurrence:'none',createdAt:new Date('2026-10-25T12:00:00').getTime(),updatedAt:0,...patch});
test('today separates next, overdue, unscheduled and completed without duplicate counts',()=>{
 const tasks=[task('late',{scheduledDate:'2026-10-30',scheduledTime:'15:00'}),task('habit',{recurrence:'daily',scheduledTime:'20:00'}),task('reading',{recurrence:'daily',scheduledTime:'21:00'}),task('milk',{isQuick:true}),task('done',{scheduledDate:'2026-11-01',scheduledTime:'08:00'})];
 const records=[{id:'r',taskId:'done',date:'2026-11-01',completedAt:now.getTime()}];
 const a=buildTodayAgenda(tasks,records,now,now);assert.equal(a.pending.length,4);assert.equal(a.completed.length,1);assert.deepEqual(a.overdue.map(x=>x.task.id),['late']);assert.equal(a.next.task.id,'habit');assert.equal(a.overdue[0].dateKey,'2026-10-30');assert.deepEqual(a.unscheduled.map(x=>x.task.id),['milk']);
});
test('past missed habits never accumulate while unfinished one-off tasks carry forward',()=>{
 const tasks=[task('habit',{recurrence:'daily',scheduledTime:'09:00'}),task('old',{scheduledDate:'2026-10-20',scheduledTime:'10:00'}),task('no-time',{scheduledDate:'2026-10-20'}),task('future',{scheduledDate:'2026-11-03',scheduledTime:'10:00'}),task('archived',{archivedAt:1})];
 const a=buildTodayAgenda(tasks,[],now,now);assert.equal(a.rows.filter(x=>x.task.id==='habit').length,1);assert.equal(a.rows.length,3);assert.equal(a.unscheduled[0].task.id,'no-time');
 const future=buildTodayAgenda(tasks,[],new Date('2026-11-03T00:00:00'),now);assert.ok(future.rows.every(x=>!x.overdue));assert.ok(future.rows.some(x=>x.task.id==='future'));assert.ok(!future.rows.some(x=>x.task.id==='old'));
});
test('finishing a carried task keeps its original occurrence and does not resurrect tomorrow',()=>{
 const t=task('old',{scheduledDate:'2026-10-30',scheduledTime:'10:00'}),r={id:'r',taskId:t.id,date:'2026-10-30',completedAt:now.getTime()};
 const today=buildTodayAgenda([t],[r],now,now);assert.equal(today.completed.length,1);assert.equal(today.pending.length,0);assert.equal(today.completed[0].dateKey,'2026-10-30');
 const tomorrow=new Date('2026-11-02T12:00:00');assert.equal(buildTodayAgenda([t],[r],tomorrow,tomorrow).rows.length,0);
 assert.equal(buildTodayAgenda([t],[r],new Date('2026-10-30T00:00:00'),now).completed.length,0);
 assert.equal(buildTodayAgenda([t],[r],now,new Date('2026-11-02T12:00:00')).completed.length,1);
});
test('completed fold only contains records actually completed on the viewed day',()=>{
 const tasks=[task('quick',{isQuick:true}),task('planned',{scheduledDate:'2026-11-01'}),task('habit',{recurrence:'daily'}),task('today',{scheduledDate:'2026-11-01'})];
 const records=tasks.map(t=>({id:'r-'+t.id,taskId:t.id,date:'2026-11-01',completedAt:t.id==='today'?now.getTime():new Date('2026-10-31T19:00:00').getTime()}));
 const agenda=buildTodayAgenda(tasks,records,now,now);
 assert.deepEqual(agenda.completed.map(row=>row.task.id),['today']);assert.equal(agenda.pending.length,0);
 assert.equal(records.length,4);
});
test('habit color follows its category and temporary tasks stay white even with a category',()=>{
 assert.equal(habitBackground(task('habit',{recurrence:'daily'}),'#34C759'),'#34C75912');assert.equal(habitBackground(task('single'),'#34C759'),'#FFFFFF');assert.equal(habitBackground(task('habit',{recurrence:'daily'}),'invalid'),'#FFFFFF');
});
