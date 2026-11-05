import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/services/holdGesture.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {HoldGesture}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function setup(){const events=[];return {events,g:new HoldGesture({start:()=>events.push('start'),release:()=>events.push('send'),cancel:()=>events.push('cancel'),changed:()=>{}})}}
test('capture loss and layout updates do not end a hold; real release sends once',()=>{const {g,events}=setup();g.begin(4,400);g.move(4,390);g.begin(4,390);g.end(8);assert.deepEqual(events,['start']);g.end(4);g.end(4);assert.deepEqual(events,['start','send'])});
test('real touch cancellation or leaving app never sends',()=>{for(const cancel of [g=>g.end(4,true),g=>g.cancel()]){const {g,events}=setup();g.begin(4,400);cancel(g);g.end(4);assert.deepEqual(events,['start','cancel'])}});
test('sliding cancellation tolerates jitter and reverses when user returns',()=>{const {g,events}=setup();g.begin(4,400);g.move(4,270);g.move(4,300);g.end(4);assert.deepEqual(events,['start','cancel']);const b=setup();b.g.begin(1,400);b.g.move(1,250);b.g.move(1,390);b.g.end(1);assert.deepEqual(b.events,['start','send'])});
