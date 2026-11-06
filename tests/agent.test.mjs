import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

async function load(){
 const state={tasks:[],records:[],categories:[{id:'work',name:'工作'},{id:'life',name:'生活'},{id:'study',name:'阅读'}],transactions:[],notes:[],transfers:[],accounts:[{id:'wx',name:'微信',type:'wechat',initialBalance:100,color:'#123'},{id:'cash',name:'现金',type:'cash',initialBalance:0,color:'#123'}],acctCategories:[{id:'out',name:'其他支出',type:'expense'},{id:'in',name:'其他收入',type:'income'}]};
 let id=0;
 for(const [suffix,table] of [['Task','tasks'],['Record','records'],['Transaction','transactions'],['Account','accounts'],['Transfer','transfers']]){
  state['add'+suffix]=value=>{const key='local-'+(++id);state[table].unshift({...value,id:key,createdAt:Date.now(),updatedAt:Date.now()});return key};
  state['update'+suffix]=(key,patch)=>{state[table]=state[table].map(item=>item.id===key?{...item,...patch}:item)};
  state['delete'+suffix]=key=>{state[table]=state[table].filter(item=>item.id!==key)};
 }
 state.addNote=content=>{const key='note-'+(++id);state.notes.unshift({id:key,content,updatedAt:Date.now()});return key};
 state.updateNote=(key,content)=>{state.notes=state.notes.map(item=>item.id===key?{...item,content}:item)};
 state.deleteNote=key=>{state.notes=state.notes.filter(item=>item.id!==key)};
 state.saveAgentTaskBatch=async(tasks,records,noteIds)=>{
  if(globalThis.agentTest.diskError)throw Error('disk_error');
  state.tasks.unshift(...tasks.filter(task=>!state.tasks.some(row=>row.id===task.id)));
  state.records.unshift(...records.filter(record=>!state.records.some(row=>row.id===record.id)));
  state.notes=state.notes.filter(note=>!noteIds.includes(note.id));
 };
 const fixture={state,values:new Map(),calendar:0,enabled:true,platform:'web'};globalThis.agentTest=fixture;
 const modules={
  '@/store':`export const useStore={getState:()=>globalThis.agentTest.state};`,
  './appStorage':`export const appStorage={getItem:k=>globalThis.agentTest.values.get(k),setItem:(k,v)=>globalThis.agentTest.values.set(k,v),removeItem:k=>globalThis.agentTest.values.delete(k)};export const flushPrivateStorage=async()=>{if(globalThis.agentTest.diskError)throw new Error('disk_error')};export const saveStorageBatch=async updates=>{if(globalThis.agentTest.diskError)throw Error('disk_error');for(const [k,v] of Object.entries(updates))globalThis.agentTest.values.set(k,v)};`,
  '@/capacitor/task-calendar':`export const isCalendarSyncEnabled=()=>globalThis.agentTest.enabled;export const syncTasksToCalendar=async()=>{globalThis.agentTest.calendar++;if(globalThis.agentTest.calendarError)throw Error('permission')};`,
  '@capacitor/core':`export const Capacitor={getPlatform:()=>globalThis.agentTest.platform};export const registerPlugin=()=>({request:options=>globalThis.agentTest.nativeRequest(options)});`,
 };
 const bundle=await build({stdin:{contents:`export * from './src/services/agent.ts';export * from './src/services/agentActions.ts';export * from './src/services/privacy.ts';export * from './src/services/voice.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'agent-test',setup(b){b.onResolve({filter:/.*/},a=>modules[a.path]?{path:a.path,namespace:'test'}:null);b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:modules[a.path],loader:'js'}));}}]});
 return {fixture,service:await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))};
}

async function saveTask(service,args){
 const {draft}=await service.executeWorkbench(args);
 return (await service.saveAgentTasks([{draft,categoryId:'work'}]))[0];
}

test('local agent validates schedules, preserves identity on edits and syncs occurrence completion',async()=>{
 const {fixture:f,service:a}=await load();
 await assert.rejects(saveTask(a,{action:'add_task'}),/补充/);assert.equal(f.state.tasks.length,0);
 await saveTask(a,{action:'add_task',title:'整理资料',date:'2026-11-02',time:'17:00'});const id=f.state.tasks[0].id;
 await a.executeWorkbench({action:'update_task',query:id,date:'2026-12-01',time:'18:00',title:'整理测试资料'});
 assert.equal(f.state.tasks.length,1);assert.equal(f.state.tasks[0].scheduledDate,'2026-12-01');assert.equal(f.state.tasks[0].id,id);
 await a.executeWorkbench({action:'complete_task',query:id});assert.equal(f.state.records[0].date,'2026-12-01');
 await a.executeWorkbench({action:'reopen_task',query:id});assert.equal(f.state.records.length,0);assert.equal(f.calendar,4);
 await assert.rejects(a.executeWorkbench({action:'update_task',query:id,time:'25:00'}),/几点/);
 await assert.rejects(a.executeWorkbench({action:'update_task',query:id,date:'2026-02-30'}),/日期/);
 f.calendarError=true;assert.match((await a.executeWorkbench({action:'update_task',query:id,time:'19:00'})).text,/日历同步暂未成功/);assert.equal(f.state.tasks[0].scheduledTime,'19:00');
 f.state.tasks.push({id:'legacy',title:'旧重复任务',recurrence:'weekly',weekdays:[1],scheduledTime:'09:00'});
 await a.executeWorkbench({action:'update_task',query:'旧重复任务',time:'10:00'});assert.equal(f.state.tasks.find(t=>t.id==='legacy').scheduledTime,'10:00');
 f.state.tasks.push({id:'quick',title:'临时小事',recurrence:'none',isQuick:true});await a.executeWorkbench({action:'update_task',query:'临时小事',title:'修改后的小事'});assert.equal(f.state.tasks.find(t=>t.id==='quick').title,'修改后的小事');
 const range=await a.executeWorkbench({action:'list_tasks',startDate:'2026-11-02',endDate:'2026-11-08'});assert.match(range.text,/2026-11-02 10:00 旧重复任务/);assert.ok(!range.text.includes('整理测试资料'));
});

test('undated and untimed todos save directly, and later scheduling preserves their identity',async()=>{
 const {fixture:f,service:a}=await load();
 const result=await saveTask(a,{action:'add_task',title:'有空整理书柜'});
 const quick=f.state.tasks[0];assert.equal(quick.isQuick,true);assert.equal(quick.scheduledTime,undefined);assert.equal(quick.scheduledDate,undefined);assert.equal(quick.reminderEnabled,false);assert.match(result.text,/时间未定/);
 await saveTask(a,{action:'add_task',title:'周一整理资料',date:'2026-11-02'});
 const dated=f.state.tasks[0];assert.equal(dated.scheduledDate,'2026-11-02');assert.equal(dated.scheduledTime,undefined);assert.equal(dated.isQuick,false);
 await a.executeWorkbench({action:'update_task',query:quick.id,date:'2026-11-03',time:'15:00'});
 const planned=f.state.tasks.find(t=>t.id===quick.id);assert.equal(planned.isQuick,false);assert.equal(planned.scheduledTime,'15:00');assert.equal(f.state.tasks.length,2);
 await a.executeWorkbench({action:'update_task',query:quick.id,time:''});
 const cleared=f.state.tasks.find(t=>t.id===quick.id);assert.equal(cleared.scheduledTime,undefined);assert.equal(cleared.scheduledDate,'2026-11-03');assert.equal(cleared.reminderEnabled,false);
 await saveTask(a,{action:'add_task',title:'每天伸展，时间待定',recurrence:'daily'});assert.equal(f.state.tasks[0].isQuick,false);assert.equal(f.state.tasks[0].scheduledTime,undefined);
 await assert.rejects(saveTask(a,{action:'add_task',title:'买菜',time:'15:00'}),/日期/);
 await assert.rejects(saveTask(a,{action:'add_task',title:'买菜',time:'三点'}),/几点/);
});

test('money and accounts are explicit; moving a bill preserves identity and transfers do not inflate expenses',async()=>{
 const {fixture:f,service:a}=await load();
 await assert.rejects(a.executeWorkbench({action:'add_transaction',type:'expense',amountCents:3000}),/账户/);
 for(const amountCents of [-1,0,30.001,NaN])await assert.rejects(a.executeWorkbench({action:'add_transaction',type:'expense',account:'微信',amountCents}),/金额/);
 await a.executeWorkbench({action:'add_transaction',type:'expense',account:'微信',amountCents:3000,note:'PRIVATE_LUNCH',date:'2026-11-01',time:'09:30'});const id=f.state.transactions[0].id;
 await a.executeWorkbench({action:'update_transaction',query:id,account:'现金',type:'income',date:'2026-11-02'});
 const bill=f.state.transactions[0];assert.equal(bill.id,id);assert.equal(bill.accountId,'cash');assert.equal(bill.type,'income');assert.equal(bill.categoryId,'in');assert.equal(new Date(bill.datetime).getHours(),9);
 await a.executeWorkbench({action:'add_transfer',fromAccount:'微信',toAccount:'现金',amountCents:1000,feeCents:100});assert.equal(f.state.transactions.length,1);assert.equal(f.state.transfers.length,1);
 assert.match((await a.executeWorkbench({action:'list_accounts'})).text,/89.00/);
 f.state.transactions.push({...bill,id:'other',type:'expense',categoryId:'out',amount:99});
 const query=await a.executeWorkbench({action:'list_transactions',category:'其他收入',amountCents:3000});assert.match(query.text,/共 1 笔，收入 ¥30.00，支出 ¥0.00/);
 await assert.rejects(a.executeWorkbench({action:'delete_account',query:'现金'}),/不能/);
 await assert.rejects(a.executeWorkbench({action:'add_account',name:'储蓄',accountType:'bank'}),/初始余额/);
 await a.executeWorkbench({action:'add_account',name:'储蓄',accountType:'bank',initialBalanceCents:0});assert.equal(f.state.accounts.length,3);
});

test('correcting completion time preserves the record, completion and planned schedule',async()=>{
 const {fixture:f,service:a}=await load();
 await saveTask(a,{action:'add_task',title:'完成时间测试',date:'2026-10-30',time:'17:00'});const task=f.state.tasks[0];
 const record={id:'original-record',taskId:task.id,taskTitle:task.title,categoryId:'work',date:'2026-10-31',completedAt:new Date('2026-10-31T18:00:00').getTime(),durationSeconds:600,note:'keep-note',progress:2};
 f.state.records=[record];
 const result=await a.executeWorkbench({action:'update_completion_time',query:task.id,completedTime:'15:00'});
 assert.equal(f.state.records.length,1);assert.equal(f.state.records[0].id,record.id);assert.equal(f.state.records[0].date,record.date);
 assert.equal(f.state.records[0].completedAt,new Date('2026-10-31T15:00:00').getTime());assert.equal(f.state.records[0].note,'keep-note');assert.equal(f.state.records[0].progress,2);
 assert.equal(task.scheduledTime,'17:00');assert.equal(task.scheduledDate,'2026-10-30');assert.match(result.text,/完成时间.*15:00/);
 await a.executeWorkbench({action:'complete_task',query:task.id,time:'16:00'});assert.equal(new Date(f.state.records[0].completedAt).getHours(),16);assert.equal(f.state.records.length,1);
 await assert.rejects(a.executeWorkbench({action:'reopen_task',query:task.id,time:'15:00'}),/完成时间/);assert.equal(f.state.records.length,1);
});

test('first completion honors the stated actual time while retaining its planned occurrence',async()=>{
 const {fixture:f,service:a}=await load();
 f.state.tasks=[{id:'once',title:'单次事项',recurrence:'none',scheduledDate:'2026-10-30',scheduledTime:'17:00',categoryId:'work'}];
 await a.executeWorkbench({action:'complete_task',query:'once',completedDate:'2026-10-31',completedTime:'15:00'});
 assert.equal(f.state.records.length,1);assert.equal(f.state.records[0].date,'2026-10-30');assert.equal(f.state.records[0].completedAt,new Date('2026-10-31T15:00:00').getTime());
 const id=f.state.records[0].id;await a.executeWorkbench({action:'complete_task',query:'once'});assert.equal(f.state.records.length,1);assert.equal(f.state.records[0].id,id);assert.equal(new Date(f.state.records[0].completedAt).getHours(),15);
});

test('completion corrections validate timestamps and isolate recurring occurrences',async()=>{
 const {fixture:f,service:a}=await load();
 f.state.tasks=[{id:'habit',title:'习惯',categoryId:'study',recurrence:'daily',scheduledTime:'09:00'}];
 f.state.records=[{id:'r1',taskId:'habit',date:'2026-10-29',completedAt:new Date('2026-10-29T18:00:00').getTime(),durationSeconds:0},{id:'r2',taskId:'habit',date:'2026-10-30',startedAt:new Date('2026-10-30T14:00:00').getTime(),completedAt:new Date('2026-10-30T18:00:00').getTime(),durationSeconds:14400}];
 await a.executeWorkbench({action:'update_completion_time',query:'habit',date:'2026-10-30',completedTime:'15:00'});
 assert.equal(new Date(f.state.records[0].completedAt).getHours(),18);assert.equal(new Date(f.state.records[1].completedAt).getHours(),15);assert.equal(f.state.records[1].durationSeconds,3600);
 for(const patch of [{completedTime:'25:00'},{completedDate:'2026-02-30',completedTime:'15:00'},{completedDate:'2099-01-01',completedTime:'15:00'},{completedTime:'13:00'}])await assert.rejects(a.executeWorkbench({action:'update_completion_time',query:'habit',date:'2026-10-30',...patch}));
 await assert.rejects(a.executeWorkbench({action:'update_completion_time',query:'habit',date:'2026-10-28',completedTime:'15:00'}),/完成记录/);
 assert.equal(f.state.records.length,2);assert.equal(new Date(f.state.records[1].completedAt).getHours(),15);
});

test('a model cannot reopen a completed task when the user only corrects its completion time',async()=>{
 const {fixture:f,service:a}=await load();const original=globalThis.fetch;
 f.state.tasks=[{id:'task',title:'测试',recurrence:'none',scheduledDate:'2026-10-30',scheduledTime:'17:00'}];
 f.state.records=[{id:'record',taskId:'task',date:'2026-10-30',completedAt:new Date('2026-10-30T18:00:00').getTime(),durationSeconds:0}];
 globalThis.fetch=async()=>Response.json({choices:[{message:{tool_calls:[{id:'wrong',type:'function',function:{name:'workbench',arguments:JSON.stringify({action:'reopen_task',query:'task',date:'2026-10-30'})}}]}}]});
 try{
  const config={url:'https://api.example/v1',key:'fake',model:'fake'};
  for(const input of ['这个事项是下午3点完成的，请修改完成时间','不，是下午4点']){const history=await a.chatWithAgent(config,{messages:[],entries:[]},input);assert.equal(f.state.records.length,1);assert.match(history.entries.at(-1).results[0].text,/完成时间/)}
  await a.chatWithAgent(config,{messages:[],entries:[]},'取消这条任务的完成状态');assert.equal(f.state.records.length,0);
 }finally{globalThis.fetch=original}
});

test('ambiguous targets and stale deletion approvals cannot delete or change records',async()=>{
 const {fixture:f,service:a}=await load();
 await a.executeWorkbench({action:'add_note',content:'测试笔记'});const id=f.state.notes[0].id;
 const pending=(await a.executeWorkbench({action:'delete_note',query:id})).pending;assert.equal(f.state.notes.length,1);assert.ok(pending);
 await a.executeWorkbench({action:'update_note',query:id,content:'修改后的内容'});
 await assert.rejects(a.executeWorkbench(pending.args,pending),/内容已经变化/);assert.equal(f.state.notes.length,1);
 const fresh=(await a.executeWorkbench({action:'delete_note',query:id})).pending;await a.executeWorkbench(fresh.args,fresh);assert.equal(f.state.notes.length,0);
 f.state.tasks=[{id:'a',title:'写报告',recurrence:'none',scheduledDate:'2026-11-02'},{id:'b',title:'写报告',recurrence:'none',scheduledDate:'2026-11-03'}];
 await assert.rejects(a.executeWorkbench({action:'complete_task',query:'写报告'}),/多条/);assert.equal(f.state.records.length,0);
 await assert.rejects(a.executeWorkbench({action:'eval',script:'anything'}),/不支持/);
 await assert.rejects(a.executeWorkbench({action:'add_note',content:'x',confirmed:true}),/不支持/);
});

test('completion-time protection still permits explicit rescheduling of an already completed task',async()=>{
 const {fixture:f,service:a}=await load();const original=globalThis.fetch;
 f.state.tasks=[{id:'task',title:'完成报告',recurrence:'none',scheduledDate:'2026-10-30',scheduledTime:'17:00'}];
 f.state.records=[{id:'record',taskId:'task',date:'2026-10-30',completedAt:new Date('2026-10-30T18:00:00').getTime(),durationSeconds:0}];
 globalThis.fetch=async()=>Response.json({choices:[{message:{tool_calls:[{id:'reschedule',type:'function',function:{name:'workbench',arguments:JSON.stringify({action:'update_task',query:'task',date:'2026-11-03',time:'16:00'})}}]}}]});
 try{await a.chatWithAgent({url:'https://api.example/v1',key:'fake',model:'fake'},{messages:[],entries:[]},'把已完成的任务改到11月3日下午4点');assert.equal(f.state.tasks[0].scheduledDate,'2026-11-03');assert.equal(f.state.records.length,1)}finally{globalThis.fetch=original}
});

test('chat executes only allowed tools; private query results and API secrets never enter model messages',async()=>{
 const {fixture:f,service:a}=await load();const original=globalThis.fetch;let calls=0;
 f.state.notes=[{id:'private-note',content:'DO_NOT_UPLOAD_NOTE'}];f.state.transactions=[{id:'bill',type:'expense',amount:23,accountId:'wx',categoryId:'out',datetime:Date.now(),note:'DO_NOT_UPLOAD_LEDGER'}];
 const config={url:'https://api.example/v1',key:'TEST_API_SECRET',model:'test-model'};
 globalThis.fetch=async(url,options)=>{
  calls++;assert.equal(url,'https://api.example/v1/chat/completions');assert.equal(options.redirect,'error');
  assert.ok(!options.body.includes('DO_NOT_UPLOAD'));assert.ok(!options.body.includes(config.key));
  const action=calls===1?{action:'list_transactions'}:{action:'list_notes'};
  if(calls===2)assert.ok(JSON.stringify(JSON.parse(options.body).messages).includes('provider-reasoning'));
  return Response.json({choices:[{message:{content:null,reasoning_content:'provider-reasoning',tool_calls:[{id:'call-'+calls,type:'function',function:{name:'workbench',arguments:JSON.stringify(action)}}]}}]});
 };
 try{
  let history=await a.chatWithAgent(config,{messages:[],entries:[]},'查账');assert.match(history.entries.at(-1).results[0].text,/DO_NOT_UPLOAD_LEDGER/);
  history=await a.chatWithAgent(config,history,'查笔记');assert.match(history.entries.at(-1).results[0].text,/DO_NOT_UPLOAD_NOTE/);
  assert.ok(!JSON.stringify(history.messages).includes('DO_NOT_UPLOAD'));
  globalThis.fetch=async()=>Response.json({choices:[{message:{tool_calls:[{id:'bad',type:'function',function:{name:'shell',arguments:'{}'}}]}}]});
  await assert.rejects(a.chatWithAgent(config,history,'测试'),/未执行/);
  globalThis.fetch=async()=>Response.json({choices:[{finish_reason:'length',message:{content:'partial'}}]});await assert.rejects(a.chatWithAgent(config,history,'测试'),/截断/);
  for(const content of ['已添加任务','已安排明天5点的日程并已同步日历']){
   globalThis.fetch=async()=>Response.json({choices:[{message:{content}}]});const noOp=await a.chatWithAgent(config,history,'测试');assert.match(noOp.entries.at(-1).text,/数据没有改变/);
  }
 }finally{globalThis.fetch=original}
});

test('configuration is Android-only and history never persists executable deletion approvals',async()=>{
 const {fixture:f,service:a}=await load();const config={url:'https://example.com/v1',key:'KEY',model:'MODEL'};
 for(const url of ['http://example.com','https://user:pass@example.com','https://example.com?key=x'])assert.throws(()=>a.agentEndpoint(url));
 assert.equal(a.agentEndpoint('https://example.com/v1/chat/completions'),'https://example.com/v1/chat/completions');
 assert.equal(a.canExportKey('wb.assistant.agent.connection.v1'),false);assert.equal(a.canExportKey('wb.assistant.agent.history.v1'),false);
 await assert.rejects(a.saveAgentConfig(config),/Android/);f.platform='android';await a.saveAgentConfig(config);assert.equal(a.readAgentConfig().key,'KEY');
 const pending={args:{action:'delete_note',query:'id'},guard:'private',label:'test'};
 await a.saveAgentHistory({messages:[{role:'tool',content:'orphan',tool_call_id:'id'},{role:'user',content:'用户输入'}],entries:[{id:'entry',role:'assistant',text:'',results:[{text:'confirm',modelStatus:'pending',pending}]}]});
 const saved=a.readAgentHistory();assert.equal(saved.messages[0].role,'user');assert.equal(saved.entries[0].results[0].pending,undefined);
 await a.saveAgentConfig({...config,url:'https://other.example/v1'});assert.equal(a.readAgentHistory().entries.length,0);
 f.diskError=true;await assert.rejects(a.saveAgentConfig(config),/disk_error/);assert.equal(a.readAgentConfig().url,'https://other.example/v1');
});

test('connection validation explains each missing field before sending any API request',async()=>{
 const {service:a}=await load();const original=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests++;throw Error('unexpected request')};
 try{
  const config={url:'https://api.example/v1',key:'TEST_KEY',model:'deepseek-flash'};
  await assert.rejects(a.testAgent({...config,url:' '}),/服务地址/);
  await assert.rejects(a.testAgent({...config,key:' '}),/API Key/);
  await assert.rejects(a.testAgent({...config,model:' '}),/模型名/);
  assert.equal(requests,0);
  assert.deepEqual(a.validateAgentConfig({url:' https://api.example/v1/ ',key:' TEST_KEY ',model:' deepseek-flash '}),config);
 }finally{globalThis.fetch=original}
});

test('released speech prepares one draft and waits for category confirmation',async()=>{
 const {fixture:f,service:a}=await load();const original=globalThis.fetch;let resolveSpeech,requests=0,complete;
 const done=new Promise(resolve=>{complete=resolve});const capture=new Promise(resolve=>{resolveSpeech=resolve});
 const config={url:'https://api.example/v1',key:'TEST_KEY',model:'test'};
 globalThis.fetch=async(_url,options)=>{
  requests++;assert.equal(JSON.parse(options.body).messages.at(-1).content,'明天下午五点整理资料');
  return Response.json({choices:[{message:{tool_calls:[{id:'voice-call',type:'function',function:{name:'workbench',arguments:JSON.stringify({action:'add_task',title:'整理资料',date:'2026-11-02',time:'17:00'})}}]}}]});
 };
 const voice=new a.HoldToTalk({status:async()=>({available:true,granted:true}),start:()=>capture,stop:async()=>{resolveSpeech({text:'明天下午五点整理资料'})},cancel:async()=>{},requestMicrophone:async()=>({granted:true})},{phase(){},error:message=>complete({error:message}),text:async text=>{try{complete(await a.chatWithAgent(config,{messages:[],entries:[]},text))}catch(error){complete({error})}}});
 try{
  await voice.press();assert.equal(requests,0);assert.equal(f.state.tasks.length,0);
  voice.release();const result=await done;assert.ok(!result.error);assert.equal(requests,1);
  assert.equal(f.state.tasks.length,0);
  const [saved]=await a.saveAgentTasks([{draft:result.entries.at(-1).results[0].draft,categoryId:'study'}]);
  assert.equal(f.state.tasks.length,1);assert.equal(f.state.tasks[0].scheduledDate,'2026-11-02');assert.equal(f.state.tasks[0].scheduledTime,'17:00');assert.equal(f.calendar,1);
  assert.equal(f.state.tasks[0].categoryId,'study');assert.match(saved.text,/已同步系统日历/);
 }finally{globalThis.fetch=original}
});

test('semantic task context and a follow-up pronoun operate the same item without sending notes or ledger contents',async()=>{
 const {fixture:f,service:a}=await load(),original=globalThis.fetch;
 f.state.tasks=[{id:'report',title:'撰写实验总结',recurrence:'none',scheduledDate:'2026-11-03',scheduledTime:'15:00',categoryId:'work',description:'PRIVATE_TASK_NOTE',createdAt:Date.now()}];
 f.state.transactions=[{id:'private',note:'PRIVATE_LEDGER'}];let operations=0;
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body),text=JSON.stringify(body);
  assert.ok(!text.includes('PRIVATE_TASK_NOTE'));assert.ok(!text.includes('PRIVATE_LEDGER'));assert.ok(text.includes('撰写实验总结'));
  if(!body.tools)return Response.json({choices:[{message:{content:operations===1?'好，已挪到明天，仍是下午三点。':'好，这件事已标记完成。'}}]});
  operations++;const input=body.messages.at(-1).content;
  assert.equal(input,operations===1?'把实验小结挪到明天':'这件事做完了');
  return Response.json({choices:[{message:{tool_calls:[{id:'action-'+operations,type:'function',function:{name:'workbench',arguments:JSON.stringify(operations===1?{action:'update_task',query:'report',date:'2026-11-04'}:{action:'complete_task',query:'report'})}}]}}]});
 };
 try{
  const config={url:'https://api.example/v1',key:'KEY',model:'MODEL'};
  let history=await a.chatWithAgent(config,{messages:[],entries:[]},'把实验小结挪到明天');
  assert.equal(f.state.tasks[0].scheduledDate,'2026-11-04');assert.equal(f.state.tasks[0].scheduledTime,'15:00');assert.equal(f.state.tasks.length,1);
  history=await a.chatWithAgent(config,history,'这件事做完了');assert.equal(f.state.records.length,1);assert.equal(f.state.records[0].taskId,'report');assert.equal(operations,2);assert.match(history.entries.at(-1).text,/已标记完成/);
 }finally{globalThis.fetch=original}
});
test('local habit rescheduling detaches just one occurrence and preserves later habits',async()=>{
 const {fixture:f,service:a}=await load();const today=new Date();const day=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 f.state.tasks=[{id:'habit',title:'锻炼',recurrence:'daily',scheduledTime:'20:00',categoryId:'life',createdAt:Date.now()-86400000}];
 await a.executeWorkbench({action:'update_task',query:'habit',targetDate:day,date:'2026-12-01'});
 assert.equal(f.state.tasks.length,2);const habit=f.state.tasks.find(task=>task.id==='habit'),moved=f.state.tasks.find(task=>task.id!=='habit');
 assert.equal(habit.recurrence,'daily');assert.deepEqual(habit.excludedDates,[day]);assert.equal(moved.recurrence,'none');assert.equal(moved.scheduledDate,'2026-12-01');assert.equal(moved.scheduledTime,'20:00');
});

test('current snapshot overrides historical time edits without inventing duplicates and includes real recurring weekdays',async()=>{
 const {fixture:f,service:a}=await load(),original=globalThis.fetch;
 f.state.tasks=[{id:'stretch',title:'拉伸运动',recurrence:'weekly',weekdays:[2,4,6],scheduledTime:'20:00',categoryId:'life',description:'PRIVATE_NOTE',createdAt:Date.now()}];
 f.state.notes=[{content:'PRIVATE_NOTEBOOK'}];f.state.transactions=[{note:'PRIVATE_LEDGER'}];
 let requests=0;
 globalThis.fetch=async(_url,options)=>{
  requests++;const body=JSON.parse(options.body),last=body.messages.at(-1);
  assert.equal(last.content,'我的拉伸运动要改晚一点，因为我还在上班。');
  const context=body.messages.at(-2);assert.equal(context.role,'user');
  const snapshot=JSON.parse(context.content.slice(context.content.indexOf('{')));
  assert.equal(snapshot.kind,'workbench_current_tasks');assert.equal(snapshot.countsByTitle['拉伸运动'],1);
  assert.equal(snapshot.tasks.length,1);assert.equal(snapshot.tasks[0].id,'stretch');assert.equal(snapshot.tasks[0].time,'20:00');assert.deepEqual(snapshot.tasks[0].weekdays,[2,4,6]);
  assert.ok(!JSON.stringify(body).includes('PRIVATE'));
  return Response.json({choices:[{message:{content:'还在上班的话，可以给下班后留一点缓冲。今晚预计几点下班？'}}]});
 };
 try{
  const config={url:'https://api.example/v1',key:'KEY',model:'MODEL'};
  const history={messages:[{role:'user',content:'每周二四六21点拉伸运动'},{role:'assistant',content:'已设21点。'},{role:'user',content:'改成20点'},{role:'assistant',content:'已改成20点。'}],entries:[]};
  const result=await a.chatWithAgent(config,history,'我的拉伸运动要改晚一点，因为我还在上班。');
  assert.equal(f.state.tasks.length,1);assert.equal(f.state.tasks[0].scheduledTime,'20:00');assert.equal(requests,1);
  assert.equal(result.messages.filter(row=>row.content?.startsWith('【应用当前任务快照')).length,0);
 }finally{globalThis.fetch=original}
});

test('recurring save feedback shows the actual weekly or monthly rule rather than a missing date',async()=>{
 const {fixture:f,service:a}=await load();
 f.state.tasks=[{id:'stretch',title:'拉伸运动',recurrence:'weekly',weekdays:[2,4,6],scheduledTime:'20:00',categoryId:'life',createdAt:Date.now()}];
 const changed=await a.executeWorkbench({action:'update_task',query:'stretch',time:'20:30'});
 assert.match(changed.text,/周二四六 20:30/);assert.ok(!changed.text.includes('日期未定'));assert.deepEqual(f.state.tasks[0].weekdays,[2,4,6]);
 await a.executeWorkbench({action:'update_task',query:'stretch',recurrence:'monthly',monthDay:15});
 const monthly=await a.executeWorkbench({action:'update_task',query:'stretch',time:'21:00'});
 assert.match(monthly.text,/每月15号 21:00/);assert.ok(!monthly.text.includes('日期未定'));
});

test('a model cannot silently invent a clock time from later while I am still at work',async()=>{
 const {fixture:f,service:a}=await load(),original=globalThis.fetch;
 f.state.tasks=[{id:'stretch',title:'拉伸运动',recurrence:'weekly',weekdays:[2,4,6],scheduledTime:'20:00',categoryId:'life',createdAt:Date.now()}];
 globalThis.fetch=async()=>Response.json({choices:[{message:{tool_calls:[{id:'invented-clock',type:'function',function:{name:'workbench',arguments:JSON.stringify({action:'update_task',query:'stretch',time:'21:30'})}}]}}]});
 try{
  const history=await a.chatWithAgent({url:'https://api.example/v1',key:'KEY',model:'MODEL'},{messages:[],entries:[]},'我的拉伸运动要改晚一点，因为我还在上班。');
  assert.equal(f.state.tasks[0].scheduledTime,'20:00');assert.equal(f.calendar,0);assert.match(history.entries.at(-1).results[0].text,/预计几点下班/);
  assert.match(history.entries.at(-1).results[0].text,/本次没有改动/);
  await a.chatWithAgent({url:'https://api.example/v1',key:'KEY',model:'MODEL'},{messages:[],entries:[]},'拉伸改晚一点，21点半吧');
  assert.equal(f.state.tasks[0].scheduledTime,'21:30');
 }finally{globalThis.fetch=original}
});


function yesterdayDate() {
 const day=new Date();
 day.setDate(day.getDate()-1);
 return [day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
}

test('completed spoken activity retries a note misclassification and waits for one batch of categories',async()=>{
 const {fixture:f,service:a}=await load(),original=globalThis.fetch;
 const config={url:'https://api.example/v1',key:'TEST_KEY',model:'test'};
 let requests=0;
 const tool=(id,args)=>({id,type:'function',function:{name:'workbench',arguments:JSON.stringify(args)}});
 globalThis.fetch=async(_url,options)=>{
  requests++;
  assert.match(options.body,/生活/);
  return Response.json({choices:[{message:{tool_calls:requests===1?[tool('bad-note',{action:'add_note',content:'敷面膜'})]:[
   tool('mask',{action:'add_task',title:'敷面膜',date:yesterdayDate(),time:'22:41',startedTime:'22:41',duration:15}),
   tool('done',{action:'complete_task',query:'敷面膜',completedTime:'22:56'}),
   tool('read',{action:'add_task',title:'看书',category:'阅读'}),
  ]}}]});
 };
 try{
  const history=await a.chatWithAgent(config,{messages:[],entries:[]},'昨天22:41～22:56我敷了面膜，另外加个看书的待办');
  assert.equal(requests,2);assert.equal(f.state.notes.length,0);assert.equal(f.state.tasks.length,0);
  const drafts=history.entries.at(-1).results.flatMap(result=>result.draft?[result.draft]:[]);
  assert.equal(drafts.length,2);assert.equal(drafts[0].record.durationSeconds,900);
  assert.equal(drafts[0].task.categoryId,'');assert.equal(drafts[1].task.categoryId,'study');
  assert.ok(a.readAgentHistory().entries.at(-1).results.every(result=>!result.draft));
  await assert.rejects(a.saveAgentTasks([{draft:drafts[0],categoryId:'life'},{draft:drafts[1],categoryId:'missing'}]),/选择/);
  assert.equal(f.state.tasks.length,0);
  await a.saveAgentTasks([{draft:drafts[0],categoryId:'life'},{draft:drafts[1],categoryId:'study'}]);
  assert.deepEqual(f.state.tasks.map(task=>task.categoryId),['life','study']);assert.equal(f.state.records[0].categoryId,'life');
 }finally{globalThis.fetch=original}
});

test('converting a note is guarded, confirms completion, and deleting a note never deletes adjacent notes',async()=>{
 const {fixture:f,service:a}=await load();
 const first=await a.executeWorkbench({action:'add_note',content:'晚上敷面膜15分钟'});
 const original=f.state.notes[0],keep=f.state.addNote('别的笔记');
 assert.match(first.modelStatus,new RegExp(original.id));
 const args={action:'add_task',title:'敷面膜',sourceNote:original.id,date:yesterdayDate(),time:'22:41',startedTime:'22:41',completedTime:'22:56',duration:15};
 const {draft}=await a.executeWorkbench(args);
 assert.equal(f.state.notes.length,2);assert.equal(f.state.tasks.length,0);
 f.state.updateNote(original.id,'敷面膜已补充');
 await assert.rejects(a.saveAgentTasks([{draft,categoryId:'life'}]),/原笔记已经变化/);
 assert.equal(f.state.tasks.length,0);assert.equal(f.state.notes.length,2);
 const fresh=(await a.executeWorkbench(args)).draft;
 const rows=[{draft:fresh,categoryId:'life'}];
 f.diskError=true;await assert.rejects(a.saveAgentTasks(rows),/disk_error/);
 assert.equal(f.state.notes.length,2);assert.equal(f.state.tasks.length,0);
 f.diskError=false;const [saved]=await a.saveAgentTasks(rows);
 assert.match(saved.text,/已标记完成（15 分钟）；已删除指定原笔记/);
 await a.saveAgentTasks(rows);
 assert.deepEqual(f.state.notes.map(note=>note.id),[keep]);assert.equal(f.state.tasks.length,1);assert.equal(f.state.records.length,1);
});
