import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';

async function bundled(path) {
  const result=await build({entryPoints:[resolve(path)],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { canSyncKey,canExportKey,scheduleOnlyValue,preservePrivateFields }=await bundled('src/services/privacy.ts');
const { buildCalendarEvents }=await bundled('src/services/calendarPlan.ts');
const task={id:'t-1',title:'写报告',categoryId:'work',recurrence:'none',scheduledDate:'2026-10-30',scheduledTime:'00:15',reminderEnabled:true,createdAt:1,updatedAt:1};

test('cloud allowlist excludes notes, finance and credentials',()=>{
  for(const key of ['wb.notes.v1','wb.acct.transactions.v1','wb.sync.auth.v1','wb.assistant.connection.v1','wb.settings.v1','wb.future.private'])assert.equal(canSyncKey(key),false);
  assert.equal(canSyncKey('wb.tasks.v1'),true);
});
test('manual backup preserves private data but excludes sessions and assistant secrets',()=>{
  assert.equal(canExportKey('wb.notes.v1'),true);
  assert.equal(canExportKey('wb.acct.transactions.v1'),true);
  assert.equal(canExportKey('wb.sync.auth.v1'),false);
  assert.equal(canExportKey('wb.assistant.connection.v1'),false);
});
test('midnight calendar time is not changed to 09:00',()=>{
  const [event]=buildCalendarEvents(task,[]);
  assert.equal(new Date(event.startMillis).getHours(),0);
  assert.equal(new Date(event.startMillis).getMinutes(),15);
});
test('completion is occurrence-specific and reversible',()=>{
  const record={taskId:task.id,date:task.scheduledDate,completedAt:123};
  assert.equal(buildCalendarEvents(task,[record])[0].completed,true);
  assert.equal(buildCalendarEvents(task,[])[0].completed,false);
  const recurring={...task,recurrence:'daily'};
  const events=buildCalendarEvents(recurring,[record],new Date(2026,9,30));
  assert.equal(events.find(e=>e.taskId.endsWith('@2026-10-30')).completed,true);
  assert.equal(events.find(e=>e.taskId.endsWith('@2026-10-31')).completed,false);
});
test('calendar never receives private task description',()=>{
  const [event]=buildCalendarEvents({...task,description:'PRIVATE NOTE'},[]);
  assert.ok(!JSON.stringify(event).includes('PRIVATE NOTE'));
  assert.equal(buildCalendarEvents({...task,archivedAt:1},[]).length,0);
});
test('legacy sync strips task descriptions and record notes without losing local notes',()=>{
  const old=JSON.stringify([{id:'t1',title:'Task',description:'PRIVATE',token:'SECRET'}]);
  const outgoing=scheduleOnlyValue('wb.tasks.v1',old);
  assert.ok(!outgoing.includes('PRIVATE'));assert.ok(!outgoing.includes('SECRET'));
  const incoming=JSON.stringify([{id:'t1',title:'Updated',description:'REMOTE PRIVATE'}]);
  const merged=JSON.parse(preservePrivateFields('wb.tasks.v1',incoming,old));
  assert.equal(merged[0].title,'Updated');assert.equal(merged[0].description,'PRIVATE');
});
