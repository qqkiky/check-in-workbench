import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

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
  }finally{await mf.dispose();}
});
