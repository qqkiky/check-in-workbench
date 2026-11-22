import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const bundle=await build({entryPoints:['src/services/taskRollover.ts'],bundle:true,write:false,format:'esm',platform:'node'})
const {rollOverdueTasks}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const now=new Date('2026-11-22T00:01:00')
const task=(id,patch={})=>({id,title:id,categoryId:'work',recurrence:'none',scheduledDate:'2026-11-21',scheduledTime:'09:00',createdAt:1,updatedAt:1,...patch})
test('missed one-offs move to today once, preserving identity, time and reminder settings',()=>{
 const original=task('one',{reminderEnabled:true,reminderLead:10})
 const result=rollOverdueTasks([original],[],now)
 assert.deepEqual(result.changedIds,['one'])
 assert.deepEqual(result.tasks[0],{...original,scheduledDate:'2026-11-22',updatedAt:now.getTime()})
 assert.equal(original.scheduledDate,'2026-11-21')
 assert.deepEqual(rollOverdueTasks(result.tasks,[],now).changedIds,[])
 assert.equal(rollOverdueTasks(result.tasks,[],new Date('2026-11-25T12:00:00')).tasks[0].scheduledDate,'2026-11-25')
})
test('completed, recurring, archived, quick, undated and future tasks keep their dates',()=>{
 const tasks=[task('done'),task('daily',{recurrence:'daily'}),task('archived',{archivedAt:1}),task('quick',{isQuick:true}),task('undated',{scheduledDate:undefined}),task('future',{scheduledDate:'2026-11-25'})]
 const result=rollOverdueTasks(tasks,[{taskId:'done',date:'2026-11-20'}],now)
 assert.deepEqual(result.changedIds,[])
 assert.deepEqual(result.tasks,tasks)
})
