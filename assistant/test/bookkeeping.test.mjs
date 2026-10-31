import test from 'node:test';
import assert from 'node:assert/strict';
import { bookkeepingInput, applyBookkeeping, receiveBookkeeping, expireBookkeeping, RETENTION_MS } from '../src/bookkeeping.mjs';

test('missing account is clarified and a later reply completes exactly one queued bill',()=>{
  const state={};
  assert.match(applyBookkeeping(state,bookkeepingInput('午饭支出30元'),'m1'),/哪个账户/);
  assert.equal(state.bookkeeping.length,0);
  const reply=applyBookkeeping(state,bookkeepingInput('账户：招商银行卡',state.bookkeepingDraft),'m2');
  assert.match(reply,/尚未入账/);
  assert.equal(state.bookkeeping.length,1);
  assert.equal(state.bookkeeping[0].amountCents,3000);
  assert.equal(state.bookkeeping[0].accountName,'招商银行卡');
  assert.equal(state.bookkeeping[0].id,'wxbook-m1');
});
test('speech transcripts support Chinese amounts and exact cents',()=>{
  assert.equal(bookkeepingInput('微信午饭支出三十二点五元').amountCents,3250);
  assert.equal(bookkeepingInput('支付宝收入一万二千零三元').amountCents,1200300);
});
test('ambiguous amounts, foreign currency and transfers cannot become an expense',()=>{
  for(const text of ['微信午饭30元晚饭50元','微信支出20美元','微信转账30元','微信支出1.234元','微信支出-30元','微信支出30万元','2026-99-99微信支出30元'])assert.ok(bookkeepingInput(text).question);
});
test('amount and direction can be supplied through follow-up messages',()=>{
  const state={};
  applyBookkeeping(state,bookkeepingInput('微信记一笔'),'m1');
  applyBookkeeping(state,bookkeepingInput('30',state.bookkeepingDraft),'m2');
  assert.equal(state.bookkeeping.length,0);
  applyBookkeeping(state,bookkeepingInput('支出',state.bookkeepingDraft),'m3');
  assert.equal(state.bookkeeping[0].amountCents,3000);
});
test('a schedule does not overwrite a pending bill and queries stay on the phone',()=>{
  assert.equal(bookkeepingInput('明天12点吃午饭'),null);
  assert.equal(bookkeepingInput('提醒我明天下午三点买午饭'),null);
  assert.equal(bookkeepingInput('明天下午3点写报告',{amountCents:3000}),null);
  assert.match(applyBookkeeping({},bookkeepingInput('本月花了多少'),'m1'),/APK/);
});
test('account rejection asks once; correction versions the bill and ignores stale receipts',()=>{
  const state={};
  applyBookkeeping(state,bookkeepingInput('微信午饭支出30元'),'m1');
  assert.equal(receiveBookkeeping(state,[{id:'wxbook-m1',version:1,status:'account_required'}]).length,1);
  assert.equal(receiveBookkeeping(state,[{id:'wxbook-m1',version:1,status:'account_required'}]).length,0);
  applyBookkeeping(state,bookkeepingInput('账户：我的微信',state.bookkeepingDraft),'m2');
  assert.equal(state.bookkeeping[0].version,2);
  receiveBookkeeping(state,[{id:'wxbook-m1',version:1,status:'applied'}]);
  assert.equal(state.bookkeeping.length,1);
  assert.equal(receiveBookkeeping(state,[{id:'wxbook-m1',version:2,status:'applied'}]).length,1);
  assert.equal(state.bookkeeping.length,0);
});
test('unclaimed bills and incomplete drafts expire after seven days',()=>{
  const state={bookkeeping:[{createdAt:1}],bookkeepingDraft:{createdAt:1}};
  expireBookkeeping(state,RETENTION_MS+1);
  assert.deepEqual(state.bookkeeping,[]);assert.equal(state.bookkeepingDraft,undefined);
});
