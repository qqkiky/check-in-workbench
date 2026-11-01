import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/services/voice.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'voice-test',setup(b){b.onResolve({filter:/^@capacitor\/core$/},()=>({path:'core',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const registerPlugin=()=>({});',loader:'js'}));}}]});
const {HoldToTalk}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const capture=deferred(),text=[],errors=[],phases=[],starts=[],stops=[],cancels=[];
 const engine={status:async()=>({available:true,granted:true}),requestMicrophone:async()=>({granted:true}),start:options=>{starts.push(options);return capture.promise},stop:async options=>{stops.push(options)},cancel:async options=>{cancels.push(options)}};
 const voice=new HoldToTalk(engine,{phase:value=>phases.push(value),text:value=>text.push(value),error:value=>errors.push(value)});
 return {voice,engine,capture,text,errors,phases,starts,stops,cancels};
}
test('holding does not send; release waits for the final transcript and sends once',async()=>{
 const f=fixture();await f.voice.press();assert.equal(f.starts.length,1);assert.deepEqual(f.text,[]);
 f.voice.release();assert.equal(f.stops.length,1);assert.deepEqual(f.text,[]);
 f.capture.resolve({text:'明天下午五点整理资料'});await tick();assert.deepEqual(f.text,['明天下午五点整理资料']);assert.equal(f.phases.at(-1),'idle');
 f.voice.release();assert.equal(f.text.length,1);
});
test('automatic recognizer completion still waits for pointer-up',async()=>{
 const f=fixture();await f.voice.press();f.capture.resolve({text:'收集资料'});await tick();assert.equal(f.phases.at(-1),'ready');assert.deepEqual(f.text,[]);
 f.voice.release();assert.deepEqual(f.text,['收集资料']);
});
test('sliding away or leaving the page discards late results and cancels capture',async()=>{
 const f=fixture();await f.voice.press();f.voice.cancel();assert.equal(f.cancels.length,1);
 f.capture.resolve({text:'不能发送这句话'});await tick();f.voice.release();assert.deepEqual(f.text,[]);assert.deepEqual(f.errors,[]);
});
test('release during preparation never starts a recording after the finger is gone',async()=>{
 const f=fixture(),status=deferred();f.engine.status=()=>status.promise;
 const press=f.voice.press();f.voice.release();status.resolve({available:true,granted:true});await press;
 assert.equal(f.starts.length,0);assert.equal(f.phases.at(-1),'idle');
});
test('permission denial and unavailable recognizers never send or capture audio',async()=>{
 const f=fixture();f.engine.status=async()=>({available:false,granted:false});await f.voice.press();assert.match(f.errors[0],/没有可用/);assert.equal(f.starts.length,0);
 const g=fixture();g.engine.status=async()=>({available:true,granted:false});g.engine.requestMicrophone=async()=>({granted:false});await g.voice.press();assert.match(g.errors[0],/未允许/);assert.equal(g.starts.length,0);
 const h=fixture();h.engine.status=async()=>({available:true,granted:false});await h.voice.press();assert.match(h.errors[0],/重新按住/);assert.equal(h.starts.length,0);
});
test('recognition failures and empty text do not become an AI message',async()=>{
 const f=fixture();await f.voice.press();f.voice.release();f.capture.reject(Error('识别超时'));await tick();assert.deepEqual(f.text,[]);assert.match(f.errors[0],/超时/);
 const g=fixture();await g.voice.press();g.voice.release();g.capture.resolve({text:'  '});await tick();assert.deepEqual(g.text,[]);assert.match(g.errors[0],/没有识别/);
});
