import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
test('opaque vault uses authentication and compare-and-swap; server stores no decryption key',async()=>{
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:[{type:'ESModule',path:'index.mjs',contents:bundle.outputFiles[0].text}],compatibilityDate:'2026-10-29',d1Databases:['DB'],bindings:{ADMIN_TOKEN:'admin',DEVICE_TOKEN:'device'}}));
 try{
  const db=await mf.getD1Database('DB');
  const sql=await readFile(new URL('../schema.sql',import.meta.url),'utf8');
  for(const part of sql.replace(/--[^\n]*/g,'').split(';').filter(value=>value.trim()))await db.prepare(part).run();
  const headers={Authorization:'Bearer device','Content-Type':'application/json'},url='https://test.workers.dev/v1/data-sync';
  assert.equal((await mf.dispatchFetch(url)).status,401);
  assert.deepEqual(await (await mf.dispatchFetch(url,{headers})).json(),{version:0,box:null});
  const box={schema:1,iv:Buffer.alloc(12).toString('base64'),data:Buffer.alloc(40,7).toString('base64')};
  const upload=(baseVersion,extra={})=>mf.dispatchFetch(url,{method:'POST',headers,body:JSON.stringify({baseVersion,box,...extra})});
  assert.equal((await upload(0,{privateKey:'NEVER_STORE'})).status,200);
  assert.equal((await upload(0)).status,409);assert.equal((await upload(1)).status,200);
  const row=await db.prepare('SELECT version,box FROM private_vault WHERE id=1').first();
  assert.equal(row.version,2);assert.ok(!JSON.stringify(row).includes('NEVER_STORE'));assert.deepEqual(JSON.parse(row.box),box);
  assert.equal((await mf.dispatchFetch(url,{method:'POST',headers,body:JSON.stringify({baseVersion:2,box:{schema:1,iv:'invalid',data:'plaintext'}})})).status,400);
 }finally{await mf.dispose()}
});
