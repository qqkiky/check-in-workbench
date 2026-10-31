import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { applyBookkeeping, bookkeepingInput } from '../src/bookkeeping.mjs';

test('real Worker runtime encrypts schedules, isolates roles and rejects stale writes',async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm',logLevel:'silent'});
  const mf=new Miniflare(convertV4MiniflareOptions({
    modules:[{type:'ESModule',path:'index.mjs',contents:bundle.outputFiles[0].text}],
    compatibilityDate:'2026-10-29',d1Databases:['DB'],
    bindings:{ADMIN_TOKEN:'test-admin-012345678901234567890123456789',DEVICE_TOKEN:'test-device-012345678901234567890123456789',STORAGE_KEY:Buffer.alloc(32,7).toString('base64')},
  }));
  try {
    const db=await mf.getD1Database('DB');
    const sql=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
    for(const statement of sql.replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim()))await db.prepare(statement).run();
    const headers={Authorization:'Bearer test-device-012345678901234567890123456789','Content-Type':'application/json'};
    const task={id:'t1',title:'PrivateTaskTitle',date:'2026-10-30',time:'15:00',status:'pending',duration:30,baseVersion:0,note:'DO_NOT_STORE_THIS'};
    const create=await mf.dispatchFetch('https://test.workers.dev/v1/schedules',{method:'POST',headers,body:JSON.stringify({tasks:[task]})});
    assert.equal(create.status,200);
    const result=await create.json();assert.equal(result.accepted[0].version,1);
    const row=await db.prepare('SELECT ciphertext FROM assistant_state WHERE id=1').first();
    assert.ok(!row.ciphertext.includes('PrivateTaskTitle'));assert.ok(!row.ciphertext.includes('DO_NOT_STORE_THIS'));
    const stale=await mf.dispatchFetch('https://test.workers.dev/v1/schedules',{method:'POST',headers,body:JSON.stringify({tasks:[{...task,title:'StaleOverwrite'}]})});
    assert.deepEqual((await stale.json()).conflicts,['t1']);
    const get=await mf.dispatchFetch('https://test.workers.dev/v1/schedules',{headers});
    const value=await get.json();assert.equal(value.tasks[0].title,'PrivateTaskTitle');assert.equal(value.tasks[0].note,undefined);
    const noAuth=await mf.dispatchFetch('https://test.workers.dev/v1/schedules');assert.equal(noAuth.status,401);
    const admin=await mf.dispatchFetch('https://test.workers.dev/admin/erase',{method:'POST',headers,body:'{}'});assert.equal(admin.status,401);
    // Seed an incoming WeChat bill into encrypted state, then exercise the actual phone API.
    const saved=await db.prepare('SELECT ciphertext FROM assistant_state WHERE id=1').first();
    const key=await crypto.subtle.importKey('raw',Buffer.alloc(32,7),'AES-GCM',false,['encrypt','decrypt']);
    const box=JSON.parse(saved.ciphertext);
    const state=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(box.iv,'base64')},key,Buffer.from(box.data,'base64'))));
    applyBookkeeping(state,bookkeepingInput('微信午饭支出30元'),'bill1');
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(state)));
    await db.prepare('UPDATE assistant_state SET ciphertext=?,version=version+1 WHERE id=1').bind(JSON.stringify({iv:Buffer.from(iv).toString('base64'),data:Buffer.from(data).toString('base64')})).run();
    assert.equal((await mf.dispatchFetch('https://test.workers.dev/v1/bookkeeping')).status,401);
    const inbox=await (await mf.dispatchFetch('https://test.workers.dev/v1/bookkeeping',{headers})).json();
    assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].amountCents,3000);
    const receipt=await mf.dispatchFetch('https://test.workers.dev/v1/bookkeeping/receipts',{method:'POST',headers,body:JSON.stringify({receipts:[{id:'wxbook-bill1',version:1,status:'applied'}],transactions:[{note:'MUST_NOT_BE_STORED'}]})});
    assert.equal(receipt.status,200);
    assert.deepEqual((await (await mf.dispatchFetch('https://test.workers.dev/v1/bookkeeping',{headers})).json()).items,[]);
    const after=await db.prepare('SELECT ciphertext FROM assistant_state WHERE id=1').first();
    const afterBox=JSON.parse(after.ciphertext);
    const plain=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(afterBox.iv,'base64')},key,Buffer.from(afterBox.data,'base64')));
    assert.ok(!plain.includes('MUST_NOT_BE_STORED'));
    assert.ok(!plain.includes('amountCents'));
  }finally{await mf.dispose();}
});
