import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('phone import survives lost receipt without duplicate bills or uploading the ledger',async()=>{
  const values=new Map();
  const state={transactions:[],accounts:[{id:'wx',name:'微信'}],acctCategories:[{id:'other',name:'其他支出',type:'expense'}],reload(){this.transactions=JSON.parse(values.get('wb.acct.transactions.v1')||'[]');}};
  let failWrite=false,failAck=true;
  globalThis.bookkeepingTest={state,values,flush:async()=>{if(failWrite)throw new Error('disk_failure');}};
  const modules={
    './appStorage':`export const appStorage={getItem:k=>globalThis.bookkeepingTest.values.get(k),setItem:(k,v)=>globalThis.bookkeepingTest.values.set(k,v)};export const flushPrivateStorage=()=>globalThis.bookkeepingTest.flush();`,
    '@capacitor/core':`export const Capacitor={getPlatform:()=> 'web'};export const registerPlugin=()=>({});`,
    './storage':`export const storage={};`,
    '@/store':`export const useStore={getState:()=>globalThis.bookkeepingTest.state};`,
    '@/capacitor/task-calendar':`export const syncTasksToCalendar=async()=>{};`,
  };
  const bundle=await build({entryPoints:['src/services/assistant.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'phone-test',setup(b){
    b.onResolve({filter:/.*/},args=>modules[args.path]?{path:args.path,namespace:'test'}:null);
    b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:modules[args.path],loader:'js'}));
  }}]});
  const {syncBookkeeping}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const originalFetch=globalThis.fetch;
  const item={id:'wxbook-m1',version:1,type:'expense',amountCents:3000,accountName:'微信',date:'2026-10-31',note:'午饭',createdAt:1};
  let ackCount=0;
  globalThis.fetch=async(url,options)=>{
    if(url.endsWith('/receipts')){
      ackCount++;
      const body=JSON.parse(options.body);
      assert.deepEqual(body,{receipts:[{id:'wxbook-m1',version:1,status:'applied'}]});
      if(failAck)throw new Error('offline');
      return Response.json({ok:true});
    }
    return Response.json({items:[item]});
  };
  try{
    const config={url:'https://test.workers.dev',token:'test-token',enabled:true};
    failWrite=true;
    await assert.rejects(syncBookkeeping(config),/disk_failure/);assert.equal(ackCount,0);
    failWrite=false;values.clear();
    await assert.rejects(syncBookkeeping(config),/offline/);
    assert.equal(state.transactions.length,1);
    failAck=false;
    await syncBookkeeping(config);assert.equal(state.transactions.length,1);
    // User deletion after an import must not be undone by a replayed cloud item.
    state.transactions=[];values.set('wb.acct.transactions.v1','[]');
    await syncBookkeeping(config);assert.equal(state.transactions.length,0);
  }finally{globalThis.fetch=originalFetch;delete globalThis.bookkeepingTest;}
});

test('transfer receipt retries and a failed disk flush cannot duplicate, lose or turn a repayment into an expense',async()=>{
 const values=new Map(),state={transactions:[],transfers:[],accounts:[{id:'bank',name:'工资卡'},{id:'card',name:'招行信用卡'}],acctCategories:[],reload(){this.transactions=JSON.parse(values.get('wb.acct.transactions.v1')||'[]');this.transfers=JSON.parse(values.get('wb.acct.transfers.v1')||'[]');}};
 let failWrite=false,failAck=true,acks=0;globalThis.transferTest={state,values,flush:async()=>{if(failWrite)throw Error('disk_failure')}};
 const modules={'./appStorage':"export const appStorage={getItem:k=>globalThis.transferTest.values.get(k),setItem:(k,v)=>globalThis.transferTest.values.set(k,v)};export const flushPrivateStorage=()=>globalThis.transferTest.flush();",'@capacitor/core':"export const Capacitor={getPlatform:()=> 'web'};export const registerPlugin=()=>({});",'./storage':"export const storage={};",'@/store':"export const useStore={getState:()=>globalThis.transferTest.state};",'@/capacitor/task-calendar':"export const syncTasksToCalendar=async()=>{};"};
 const bundle=await build({entryPoints:['src/services/assistant.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'transfer-test',setup(b){b.onResolve({filter:/.*/},a=>modules[a.path]?{path:a.path,namespace:'test'}:null);b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:modules[a.path],loader:'js'}));}}]});
 const {syncBookkeeping}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const item={id:'wxbook-repay',version:1,type:'transfer',fromAccount:'工资卡',toAccount:'招行信用卡',amountCents:120000,date:'2026-11-03',note:'信用卡还款',createdAt:Date.now()};
 const original=globalThis.fetch;globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/receipts')){acks++;const body=JSON.parse(options.body);assert.deepEqual(body,{receipts:[{id:item.id,version:1,status:'applied'}]});assert.ok(!options.body.includes('工资卡'));if(failAck)throw Error('offline');return Response.json({ok:true});}
  return Response.json({items:[item]});
 };
 try{
  const config={url:'https://test.workers.dev',token:'TEST',enabled:true};
  failWrite=true;await assert.rejects(syncBookkeeping(config),/disk_failure/);assert.equal(acks,0);assert.equal(state.transfers.length,0);
  failWrite=false;await assert.rejects(syncBookkeeping(config),/offline/);assert.equal(state.transfers.length,1);assert.equal(state.transactions.length,0);
  failAck=false;await syncBookkeeping(config);assert.equal(state.transfers.length,1);assert.equal(state.transfers[0].amount,1200);
  state.transfers=[];values.set('wb.acct.transfers.v1','[]');await syncBookkeeping(config);assert.equal(state.transfers.length,0);
 }finally{globalThis.fetch=original;delete globalThis.transferTest}
});
