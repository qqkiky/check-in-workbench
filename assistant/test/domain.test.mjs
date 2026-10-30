import test from 'node:test';
import assert from 'node:assert/strict';
import { safeTask,ruleActions,applyActions } from '../src/domain.mjs';
import worker from '../src/worker.mjs';
const now=Date.parse('2026-10-30T09:00:00+08:00');
const existing={id:'t-1',title:'写报告',date:'2026-10-30',time:'15:00',status:'pending',duration:30,version:1};
test('free rule parser can split tasks and parse afternoon time',()=>{
  const actions=ruleActions('明天下午3点写报告，后天上午9点开会',now);
  assert.equal(actions.length,2);assert.equal(actions[0].time,'15:00');assert.equal(actions[0].date,'2026-10-31');
  assert.equal(actions[1].time,'09:00');
});
test('completing a task preserves its identity and sets completion time',()=>{
  const result=applyActions([existing],ruleActions('写报告完成了'),now);
  assert.equal(result.tasks[0].id,'t-1');assert.equal(result.tasks[0].status,'completed');assert.equal(result.tasks[0].completedAt,now);
});
test('ambiguous completion asks for clarification and changes nothing',()=>{
  const other={...existing,id:'t-2',title:'写报告第二份'};
  const result=applyActions([existing,other],[{type:'complete',query:'报告'}],now);
  assert.ok(result.tasks.every(t=>t.status==='pending'));assert.match(result.reply,/多项/);
});
test('message replay cannot create duplicate tasks',()=>{
  const actions=[{type:'create',title:'开会',date:'2026-10-31',time:'09:00'}];
  const first=applyActions([],actions,now,'message-1');
  const second=applyActions(first.tasks,actions,now,'message-1');
  assert.equal(second.tasks.length,1);
});
test('task payload discards all non-schedule fields',()=>{
  const clean=safeTask({...existing,note:'SECRET',accessToken:'SECRET',accounts:['SECRET']});
  assert.ok(!JSON.stringify(clean).includes('SECRET'));
  assert.throws(()=>safeTask({...existing,date:'2026-02-30'}));
  assert.throws(()=>safeTask({...existing,time:'25:00'}));
});
test('ambiguous time does not create fabricated schedules',()=>{
  assert.deepEqual(ruleActions('明天提醒我写报告',now),[]);
});
test('unauthorized requests are rejected without touching storage',async()=>{
  const env={ADMIN_TOKEN:'admin-secret',DEVICE_TOKEN:'device-secret'};
  const response=await worker.fetch(new Request('https://test.workers.dev/v1/schedules'),env);
  assert.equal(response.status,401);
  const origin=await worker.fetch(new Request('https://test.workers.dev/v1/schedules',{headers:{Origin:'https://evil.example'}}),env);
  assert.equal(origin.status,403);
});
test('device token cannot access administrator pairing endpoints',async()=>{
  const response=await worker.fetch(new Request('https://test.workers.dev/admin/weixin/start',{method:'POST',headers:{Authorization:'Bearer device-secret'}}),{ADMIN_TOKEN:'admin-secret',DEVICE_TOKEN:'device-secret'});
  assert.equal(response.status,401);
});
