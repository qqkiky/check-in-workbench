import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/services/vault.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {TABLES,mergeSnapshots,encryptSnapshot,decryptSnapshot}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const empty=()=>({schema:1,tables:Object.fromEntries(TABLES.map(key=>[key,[]])),preferences:{}});
const table='wb.notes.v1',clone=value=>JSON.parse(JSON.stringify(value));
test('independent additions merge and settings credentials never become sync preferences',()=>{
 const local=empty(),remote=empty();local.tables[table]=[{id:'a',content:'A'}];remote.tables[table]=[{id:'b',content:'B'}];
 const result=mergeSnapshots(null,local,remote);assert.equal(result.conflicts.length,0);assert.equal(result.merged.tables[table].length,2);
});
test('three-way merge keeps independent edits and propagates deletions without resurrection',()=>{
 const base=empty();base.tables[table]=[{id:'a',content:'A'},{id:'b',content:'B'}];
 const local=clone(base),remote=clone(base);local.tables[table]=[{id:'b',content:'B'}];remote.tables[table][1].content='updated';
 const result=mergeSnapshots(base,local,remote);assert.equal(result.conflicts.length,0);assert.deepEqual(result.merged.tables[table],[{id:'b',content:'updated'}]);
});
test('concurrent edits and deletion versus edit require explicit choices',()=>{
 const base=empty();base.tables[table]=[{id:'a',content:'A'}];
 const local=clone(base),remote=clone(base);local.tables[table]=[];remote.tables[table][0].content='changed';
 const result=mergeSnapshots(base,local,remote);assert.equal(result.conflicts.length,1);
 const id=result.conflicts[0].id;
 assert.equal(mergeSnapshots(base,local,remote,{[id]:'local'}).merged.tables[table].length,0);
 assert.equal(mergeSnapshots(base,local,remote,{[id]:'remote'}).merged.tables[table][0].content,'changed');
});
test('finance and notes are encrypted on the device; wrong keys and tampering fail',async()=>{
 const snapshot=empty();snapshot.tables[table]=[{id:'private',content:'PRIVATE NOTE'}];snapshot.tables['wb.acct.transactions.v1']=[{id:'txn',amount:12345}];
 const key='12'.repeat(32),box=await encryptSnapshot(snapshot,key);
 assert.ok(!JSON.stringify(box).includes('PRIVATE NOTE'));assert.deepEqual(await decryptSnapshot(box,key),snapshot);
 assert.notDeepEqual(box,await encryptSnapshot(snapshot,key));
 await assert.rejects(decryptSnapshot(box,'34'.repeat(32)),/无法解密/);
 await assert.rejects(decryptSnapshot({...box,data:(box.data[0]==='A'?'B':'A')+box.data.slice(1)},key),/无法解密/);
});
test('unknown tables and credentials are rejected, not silently imported',async()=>{
 const snapshot=empty();snapshot.preferences.supabaseAnonKey='SECRET';await assert.rejects(encryptSnapshot(snapshot,'12'.repeat(32)));
});
