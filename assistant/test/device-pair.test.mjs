import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
test('device connection codes are admin-created, single use and limited to ten attempts',async()=>{
 let row=null;
 const env={ADMIN_TOKEN:'admin',DEVICE_TOKEN:'private-device-token',STORAGE_KEY:Buffer.alloc(32,7).toString('base64'),DB:{prepare(){return {args:[],bind(...args){this.args=args;return this},first:async()=>row,async run(){row={version:(row?.version||0)+1,ciphertext:this.args[0]};return {meta:{changes:1}}}}}}};
 const call=(path,body={},token='')=>worker.fetch(new Request('https://test.workers.dev'+path,{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}),env);
 assert.equal((await call('/admin/device-pair')).status,401);
 const {code}=await (await call('/admin/device-pair',{},'admin')).json();assert.match(code,/^\d{8}$/);
 assert.equal((await call('/v1/device-pair',{code:'wrong'})).status,400);
 const paired=await call('/v1/device-pair',{code});assert.equal((await paired.json()).token,env.DEVICE_TOKEN);
 assert.equal((await call('/v1/device-pair',{code})).status,403);
 const again=await (await call('/admin/device-pair',{},'admin')).json();
 const wrong=again.code==='00000000'?'11111111':'00000000';
 for(let i=0;i<10;i++)assert.equal((await call('/v1/device-pair',{code:wrong})).status,403);
 assert.equal((await call('/v1/device-pair',{code:again.code})).status,403);
});
