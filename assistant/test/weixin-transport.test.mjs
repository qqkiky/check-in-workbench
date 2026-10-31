import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';

test('QR login works with edge redirect restrictions and never follows a redirect with credentials',async()=>{
  const original=globalThis.fetch;
  let redirect=false,calls=0;
  globalThis.fetch=async(_url,options)=>{
    calls++;
    if(!['follow','manual'].includes(options.redirect))throw new TypeError('Invalid redirect value on Workers');
    assert.equal(options.redirect,'manual');
    assert.equal(options.headers.Authorization,undefined);
    return redirect ? new Response(null,{status:302,headers:{Location:'https://untrusted.example/'}}) : Response.json({qrcode:'test-qr-nonce',qrcode_img_content:'https://weixin.qq.com/test'});
  };
  const env={ADMIN_TOKEN:'test-admin',DEVICE_TOKEN:'test-device',STORAGE_KEY:Buffer.alloc(32,7).toString('base64'),DB:{prepare(){return {first:async()=>null,bind(){return this;},run:async()=>({meta:{changes:1}})}}}};
  const request=()=>new Request('https://test.workers.dev/admin/weixin/start',{method:'POST',headers:{Authorization:'Bearer test-admin'},body:'{}'});
  try{
    const ok=await worker.fetch(request(),env);assert.equal(ok.status,200);assert.equal((await ok.json()).qrcode,'test-qr-nonce');
    redirect=true;
    const blocked=await worker.fetch(request(),env);assert.equal(blocked.status,400);assert.equal((await blocked.json()).reason,'weixin_http_302');
    assert.equal(calls,2);
  }finally{globalThis.fetch=original;}
});
