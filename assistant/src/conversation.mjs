import { validDate, safeTask } from './domain.mjs';

export function activeDraft(state, now=Date.now()) {
  return state.scheduleDraft && now-state.scheduleDraft.updatedAt < 86400000 ? state.scheduleDraft : null;
}
export function cleanDraft(value, now=Date.now()) {
  if (!value) return null;
  if (!Array.isArray(value.items) || value.items.length>10 || typeof value.question!=='string') throw new Error('invalid_draft');
  const items=value.items.map(item=>{
    const clean={};
    if (typeof item.title==='string' && item.title.trim()) clean.title=item.title.trim().slice(0,200);
    if (item.date) { if(!validDate(item.date))throw new Error('invalid_draft_date');clean.date=item.date; }
    if (item.time) { if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))throw new Error('invalid_draft_time');clean.time=item.time; }
    if (['上午','下午','晚上','中午','早上'].includes(item.period))clean.period=item.period;
    return clean;
  });
  return items.length ? {items,question:value.question.slice(0,180),updatedAt:now} : null;
}
export function cleanInterpretation(value, now=Date.now(), draft=null, tasks=[]) {
  if (!Array.isArray(value?.actions) || value.actions.length>10)throw new Error('invalid_actions');
  let nextDraft=value.draft!==undefined?cleanDraft(value.draft,now):undefined;
  const ready=(nextDraft?.items || []).filter(item=>item.title && item.date && item.time);
  let actions=value.actions.map(action=>{
    if (action.type==='create') {
      const task=safeTask({...action,id:'validation',status:'pending'});
      return {type:'create',title:task.title,date:task.date,time:task.time,duration:task.duration};
    }
    if (action.type==='clarify' && typeof action.question==='string')return {type:'clarify',question:action.question.slice(0,300)};
    if (action.type==='list')return {type:'list',...(action.date && validDate(action.date)?{date:action.date}:{})};
    if (['complete','cancel','reschedule'].includes(action.type) && typeof action.query==='string') {
      if(action.type==='reschedule')safeTask({...action,id:'validation',title:'改期',status:'pending'});
      const unfinished=draft?.items.filter(item=>item.title===action.query) || [];
      const completedSlots=ready.find(item=>item.title===action.query);
      if(action.type!=='cancel' && unfinished.length===1 && completedSlots && !tasks.some(task=>task.status==='pending' && task.title.includes(action.query))) {
        return {type:'create',title:completedSlots.title,date:completedSlots.date,time:completedSlots.time,duration:30};
      }
      if(action.type==='reschedule' && unfinished.length===1 && !tasks.some(task=>task.status==='pending' && task.title.includes(action.query))) {
        return {type:'create',title:unfinished[0].title,date:action.date,time:action.time,duration:30};
      }
      return {type:action.type,query:action.query.slice(0,200),...(action.type==='reschedule'?{date:action.date,time:action.time}:{})};
    }
    throw new Error('invalid_action');
  });
  for(const item of ready) {
    if(!actions.some(action=>action.type==='create' && action.title===item.title && action.date===item.date && action.time===item.time))actions.push({type:'create',title:item.title,date:item.date,time:item.time,duration:30});
  }
  if(nextDraft && ready.length) {
    nextDraft.items=nextDraft.items.filter(item=>!ready.includes(item));
    if(!nextDraft.items.length){nextDraft=null;actions=actions.filter(action=>action.type!=='clarify');}
  }
  if(actions.length>10)throw new Error('too_many_actions');
  if(draft && value.draft==null && !actions.some(action=>action.type==='create' && draft.items.some(item=>item.title===action.title)))return {actions};
  return {actions,...(value.draft!==undefined?{draft:nextDraft}:actions.some(action=>action.type==='clarify')?{}:{draft:null})};
}
