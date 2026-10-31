import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
test('two devices merge new data, ask on conflicts, reject wrong keys and never upload plaintext',async()=>{
 const fixtures={values:new Map(),config:{url:'https://sync.example',token:'test-connection-token-at-least-32chars',enabled:false}};
 globalThis.vaultTest=fixtures;
 const modules={
  './appStorage':`export const appStorage={getItem:k=>globalThis.vaultTest.values.get(k),setItem:(k,v)=>globalThis.vaultTest.values.set(k,v)};export const flushPrivateStorage=async()=>{};`,
  '@/store':`export const useStore={getState:()=>({reload(){}})};`,
  './assistant':`export const endpoint=u=>new URL(u).origin;export const readAssistantConfig=()=>globalThis.vaultTest.config;export const saveAssistantConfig=async c=>{globalThis.vaultTest.config=c};export const lockAssistantForDataSync=()=>()=>{};`,
 };
 const bundle=await build({entryPoints:['src/services/deviceSync.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'vault-test',setup(b){b.onResolve({filter:/.*/},args=>modules[args.path]?{path:args.path,namespace:'test'}:null);b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:modules[args.path],loader:'js'}));}}]});
 const service=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
 const original=globalThis.fetch;
 let cloud={version:0,box:null},posts=0;
 const key='12'.repeat(32),notes='wb.notes.v1';
 globalThis.fetch=async(_url,options)=>{
  if(options.method==='GET')return Response.json(cloud);
  posts++;
  const body=JSON.parse(options.body);assert.deepEqual(Object.keys(body).sort(),['baseVersion','box']);
  assert.ok(!options.body.includes('PRIVATE_A'));assert.ok(!options.body.includes(key));
  if(body.baseVersion!==cloud.version)return Response.json({error:'conflict'},{status:409});
  cloud={version:cloud.version+1,box:body.box};return Response.json({version:cloud.version});
 };
 const noteList=()=>JSON.parse(fixtures.values.get(notes)||'[]');
 try{
  const a=new Map([[notes,JSON.stringify([{id:'a',content:'PRIVATE_A'}])]]),b=new Map([[notes,JSON.stringify([{id:'b',content:'B'}])]]);
  fixtures.values=a;await service.saveDataConnection(fixtures.config.url,fixtures.config.token,key);
  await service.commitDataSync(await service.prepareDataSync());
  fixtures.values=b;await service.saveDataConnection(fixtures.config.url,fixtures.config.token,key);
  await service.commitDataSync(await service.prepareDataSync());assert.equal(noteList().length,2);
  fixtures.values=a;a.set(notes,JSON.stringify([{id:'a',content:'A2'}]));
  await service.commitDataSync(await service.prepareDataSync());assert.equal(noteList().length,2);
  fixtures.values=b;b.set(notes,JSON.stringify(noteList().map(note=>note.id==='a'?{...note,content:'B2'}:note)));
  const plan=await service.prepareDataSync();assert.equal(plan.conflicts.length,1);
  await assert.rejects(service.commitDataSync(plan),/所有冲突/);
  await service.commitDataSync(plan,{[plan.conflicts[0].id]:'remote'});assert.equal(noteList().find(note=>note.id==='a').content,'A2');
  const stale=await service.prepareDataSync();cloud.version++;
  await assert.rejects(service.commitDataSync(stale),/另一台设备/);
  const before=posts;b.set('wb.sync.vault.key.v1','34'.repeat(32));
  await assert.rejects(service.prepareDataSync(),/无法解密/);assert.equal(posts,before);
 }finally{globalThis.fetch=original;delete globalThis.vaultTest}
});
