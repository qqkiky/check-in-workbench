import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

async function load(){
 const state={tasks:[],records:[],transactions:[],notes:[],transfers:[],accounts:[{id:'wx',name:'微信',type:'wechat',initialBalance:100,color:'#123'},{id:'cash',name:'现金',type:'cash',initialBalance:0,color:'#123'}],acctCategories:[{id:'out',name:'其他支出',type:'expense'},{id:'in',name:'其他收入',type:'income'}]};
 let id=0;
 for(const [suffix,table] of [['Task','tasks'],['Record','records'],['Transaction','transactions'],['Account','accounts'],['Transfer','transfers']]){
  state['add'+suffix]=value=>{const key='local-'+(++id);state[table].unshift({...value,id:key,createdAt:Date.now(),updatedAt:Date.now()});return key};
  state['update'+suffix]=(key,patch)=>{state[table]=state[table].map(item=>item.id===key?{...item,...patch}:item)};
  state['delete'+suffix]=key=>{state[table]=state[table].filter(item=>item.id!==key)};
 }
 state.addNote=content=>state.notes.unshift({id:'note-'+(++id),content,updatedAt:Date.now()});
 state.updateNote=(key,content)=>{state.notes=state.notes.map(item=>item.id===key?{...item,content}:item)};
 state.deleteNote=key=>{state.notes=state.notes.filter(item=>item.id!==key)};
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

test('local agent validates schedules, preserves identity on edits and syncs occurrence completion',async()=>{
 const {fixture:f,service:a}=await load();
 await assert.rejects(a.executeWorkbench({action:'add_task',title:'报告'}),/补充/);assert.equal(f.state.tasks.length,0);
 await a.executeWorkbench({action:'add_task',title:'整理资料',date:'2026-11-02',time:'17:00'});const id=f.state.tasks[0].id;
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

test('released speech calls AI once and automatically saves its schedule and calendar update',async()=>{
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
  assert.equal(f.state.tasks.length,1);assert.equal(f.state.tasks[0].scheduledDate,'2026-11-02');assert.equal(f.state.tasks[0].scheduledTime,'17:00');assert.equal(f.calendar,1);
  assert.match(result.entries.at(-1).results[0].text,/已同步系统日历/);
 }finally{globalThis.fetch=original}
});
