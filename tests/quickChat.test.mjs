import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/services/quickChat.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'quick-chat-test',setup(b){b.onResolve({filter:/^@capacitor\/core$/},()=>({path:'core',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export const Capacitor={isNativePlatform:()=>globalThis.quickNative.native};export const registerPlugin=()=>({consumeLaunch:()=>globalThis.quickNative.consumeLaunch(),addListener:(...args)=>globalThis.quickNative.addListener(...args)});`,loader:'js'}));}}]});
const {listenForQuickChat}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(pending=false){
 const state={native:true,pending,opens:0,reads:0,removed:0,listeners:new Set(),consumeLaunch:async()=>{state.reads++;const open=state.pending;state.pending=false;return {open}},addListener:async(event,callback)=>{assert.equal(event,'openChat');state.listeners.add(callback);return {remove:async()=>{state.removed++;state.listeners.delete(callback)}}}};
 globalThis.quickNative=state;
 state.launch=()=>{state.pending=true;for(const callback of state.listeners)callback()};
 state.listen=()=>listenForQuickChat(()=>state.opens++);
 return state;
}
test('cold quick-chat launch is consumed once and normal launches keep their current screen',async()=>{
 const f=fixture(true),stop=f.listen();await tick();assert.equal(f.opens,1);assert.equal(f.pending,false);
 for(const callback of f.listeners)callback();await tick();assert.equal(f.opens,1);stop();
 const g=fixture(),cleanup=g.listen();await tick();assert.equal(g.opens,0);cleanup();
});
test('each later tile tap opens chat even while the app is already running',async()=>{
 const f=fixture(),stop=f.listen();await tick();f.launch();await tick();f.launch();await tick();assert.equal(f.opens,2);stop();assert.equal(f.listeners.size,0);
});
test('StrictMode cleanup does not consume the cold launch or leave a duplicate listener',async()=>{
 const f=fixture(true),stop=f.listen();stop();const live=f.listen();await tick();assert.equal(f.opens,1);assert.equal(f.listeners.size,1);assert.equal(f.removed,1);live();
});
test('web launch never calls native entry points and unavailable bridges leave normal navigation usable',async()=>{
 const f=fixture();f.native=false;f.listen()();await tick();assert.equal(f.reads,0);assert.equal(f.listeners.size,0);
 const g=fixture();g.consumeLaunch=async()=>{throw Error('unavailable')};const stop=g.listen();await tick();assert.equal(g.opens,0);stop();
});
