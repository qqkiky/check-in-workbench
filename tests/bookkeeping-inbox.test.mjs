import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle=await build({entryPoints:['src/services/bookkeepingInbox.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const { inboxTransaction }=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const item={id:'wxbook-m1',version:1,type:'expense',amountCents:3000,accountName:'微信',date:'2026-10-31',note:'午饭',createdAt:100};
const accounts=[{id:'wx',name:'微信'}],categories=[{id:'other',name:'其他支出',type:'expense'}];
test('the phone matches the explicitly named account and keeps a stable import id',()=>{
  const txn=inboxTransaction(item,accounts,categories);
  assert.equal(txn.id,item.id);assert.equal(txn.amount,30);assert.equal(txn.accountId,'wx');
  assert.equal(txn.categoryId,'other');assert.equal(txn.note,'午饭');
});
test('missing and duplicate accounts never fall back to a default account',()=>{
  assert.equal(inboxTransaction(item,[{id:'cash',name:'现金'}],categories),null);
  assert.equal(inboxTransaction(item,[...accounts,...accounts],categories),null);
});
test('invalid financial values are rejected before touching the ledger',()=>{
  for(const patch of [{amountCents:-1},{amountCents:1.1},{date:'2026-02-30'},{type:'transfer'},{note:{}}])assert.throws(()=>inboxTransaction({...item,...patch},accounts,categories));
});
