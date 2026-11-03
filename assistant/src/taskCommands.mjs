import { cstDay, resolveTask, applyActions } from './domain.mjs';
export function effectiveAgenda(state) {
  let tasks=(state.agenda?.tasks||[]).map(task=>structuredClone(task));
  for(const command of state.taskCommands||[]) {
    const index=tasks.findIndex(task=>task.id===command.taskId);
    if(index<0 || JSON.stringify(tasks[index])!==JSON.stringify(command.base))continue;
    const task=tasks[index],action=command.action,day=command.targetDate;
    if(action.type==='complete') {task.completedDates=[...new Set([...task.completedDates,day])].sort();if(task.recurrence==='none')task.completed=true;}
    else if(action.type==='cancel') {task.excludedDates=[...new Set([...task.excludedDates,day])].sort();}
    else if(action.type==='update') {
      if(task.recurrence!=='none'&&action.date&&action.date!==day) {
        task.excludedDates=[...new Set([...task.excludedDates,day])].sort();
        tasks.push({...structuredClone(task),id:'wxmove-'+command.id,title:action.title||task.title,date:action.date,time:action.time??task.time,recurrence:'none',weekdays:[],monthDay:0,excludedDates:[],completedDates:[],completed:false});
      } else {for(const key of ['title','date','time'])if(action[key]!==undefined)task[key]=action[key];}
    }
  }
  return tasks;
}
export function conversationTasks(state,now=Date.now()) {
  const existing=new Set(state.tasks.map(task=>task.id));
  return [...state.tasks,...effectiveAgenda(state).filter(task=>!existing.has(task.id)).map(task=>({...task,date:task.date||cstDay(now),status:task.completed&&task.recurrence==='none'||task.completedDates.includes(cstDay(now))?'completed':'pending'}))];
}
export function applyConversationActions(state,actions,now=Date.now(),sourceId='manual') {
  const replies=[];let focusId;
  for(const [index,action] of actions.entries()) {
    if(!['complete','cancel','update','reschedule'].includes(action.type)) {
      const result=applyActions(state.tasks,[action],now,sourceId+'-'+index);state.tasks=result.tasks;replies.push(result.reply);continue;
    }
    const result=resolveTask(conversationTasks(state,now),action.taskId||action.query);
    if(result.error){replies.push(result.error);continue;}
    const target=result.task;
    if(state.tasks.some(task=>task.id===target.id)) {
      const updated=applyActions(state.tasks,[{...action,query:target.id}],now,sourceId+'-'+index);
      state.tasks=updated.tasks;replies.push(updated.reply);focusId=target.id;continue;
    }
    const base=effectiveAgenda(state).find(task=>task.id===target.id),day=action.targetDate||((action.type==='complete'||action.type==='cancel')?action.date:null)||base.date||cstDay(now);
    state.taskCommands=state.taskCommands||[];
    if(state.taskCommands.length>=100){replies.push('还有较多调整等待手机接收，请先打开期待同步。');continue;}
    const id=sourceId.replace(/[^\w-]/g,'').slice(0,48)+'-'+index;
    if(!state.taskCommands.some(command=>command.id===id))state.taskCommands.push({id,taskId:target.id,targetDate:day,base,action:{...action,type:action.type==='reschedule'?'update':action.type,query:target.id},createdAt:now});
    focusId=base.recurrence!=='none'&&action.date&&action.date!==day?'wxmove-'+id:target.id;
    const changed=effectiveAgenda(state).find(task=>task.id===focusId);
    replies.push(action.type==='complete'?`好，「${target.title}」已标记完成；等待手机接收。`:action.type==='cancel'?`好，已取消「${target.title}」这一次安排；等待手机接收。`:`好，已调整「${changed?.title||target.title}」到 ${changed?.date||day} ${changed?.time||'时间未定'}；等待手机接收。`);
  }
  return {tasks:state.tasks,reply:replies.join('\n'),focusId};
}
