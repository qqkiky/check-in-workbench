import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const buildResult=await build({stdin:{contents:"export * from './src/services/bookkeepingTransfer.ts';export * from './src/services/taskCommandInbox.ts';export * from './src/services/assistantAgenda.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',alias:{'@':process.cwd()+'/src'}});
const {inboxTransfer,applyTaskCommand,assistantAgendaItem}=await import('data:text/javascript;base64,'+Buffer.from(buildResult.outputFiles[0].text).toString('base64'));
const now=Date.parse('2026-11-03T13:00:00+08:00');
const habit={id:'h',title:'简单锻炼',recurrence:'daily',scheduledTime:'20:00',createdAt:now-86400000,categoryId:'life',description:'PRIVATE_NOTE'};
test('phone applies only the moved occurrence, retaining the habit and private remarks; stale commands do not overwrite edits',()=>{
  const tasks=[structuredClone(habit)],records=[],base=assistantAgendaItem(tasks[0],records,new Date(now));
  const command={id:'move-0',taskId:'h',targetDate:'2026-11-03',base,action:{type:'update',date:'2026-11-04'},createdAt:now};
  assert.equal(applyTaskCommand(tasks,records,command,now),true);assert.equal(tasks.length,2);
  const original=tasks.find(task=>task.id==='h'),moved=tasks.find(task=>task.id==='wxmove-move-0');
  assert.deepEqual(original.excludedDates,['2026-11-03']);assert.equal(original.recurrence,'daily');assert.equal(moved.recurrence,'none');assert.equal(moved.scheduledDate,'2026-11-04');assert.equal(moved.scheduledTime,'20:00');assert.equal(moved.description,'PRIVATE_NOTE');
  assert.equal(applyTaskCommand(tasks,records,command,now),false);assert.equal(tasks.length,2);
  const edited=[{...habit,title:'手机新标题'}];assert.equal(applyTaskCommand(edited,[],command,now),false);assert.equal(edited[0].title,'手机新标题');
});
test('phone completion imports one occurrence without cancelling later habits',()=>{
  const tasks=[structuredClone(habit)],records=[],command={id:'done-0',taskId:'h',targetDate:'2026-11-03',base:assistantAgendaItem(habit,[],new Date(now)),action:{type:'complete'},createdAt:now};
  assert.equal(applyTaskCommand(tasks,records,command,now),true);assert.equal(records.length,1);assert.equal(records[0].date,'2026-11-03');assert.equal(tasks[0].recurrence,'daily');
  assert.equal(applyTaskCommand(tasks,records,command,now),false);assert.equal(records.length,1);
});
test('credit repayment uses named accounts, exact cents and a stable transfer ID, never a consumption record',()=>{
  const accounts=[{id:'bank',name:'工资卡',type:'bank'},{id:'card',name:'招行信用卡',type:'card'}];
  const item={id:'wxbook-repay',version:1,type:'transfer',amountCents:120000,feeCents:100,fromAccount:'工资卡',toAccount:'招行信用卡',date:'2026-11-03',note:'信用卡还款',createdAt:now};
  const transfer=inboxTransfer(item,accounts);assert.equal(transfer.fromAccountId,'bank');assert.equal(transfer.toAccountId,'card');assert.equal(transfer.amount,1200);assert.equal(transfer.fee,1);assert.equal(transfer.id,item.id);
  assert.equal(inboxTransfer({...item,fromAccount:'不存在的卡'},accounts),null);assert.equal(inboxTransfer({...item,toAccount:'工资卡'},accounts),null);
  assert.equal(inboxTransfer(item,[...accounts,{id:'duplicate',name:'工资卡'}]),null);
  for(const patch of [{amountCents:0},{amountCents:1.1},{feeCents:-1},{date:'2026-02-30'}])assert.throws(()=>inboxTransfer({...item,...patch},accounts));
});
