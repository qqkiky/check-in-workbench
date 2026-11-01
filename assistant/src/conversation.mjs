import { validDate, safeTask } from './domain.mjs';

export function activeDraft(state, now=Date.now()) {
  return state.scheduleDraft && now-state.scheduleDraft.updatedAt < 86400000 ? state.scheduleDraft : null;
}
export function activeFocus(state, now=Date.now()) {
  const focus=state.scheduleFocus;
  return focus && now-focus.updatedAt<15*60000 ? state.tasks.find(task=>task.id===focus.id && task.status==='pending') || null : null;
}
export function rememberFocus(state, before, after, now=Date.now()) {
  const changed=after.filter(task=>task.status==='pending' && !before.some(previous=>previous.id===task.id && previous.version===task.version));
  if(changed.length===1)state.scheduleFocus={id:changed[0].id,updatedAt:now};
  else if(changed.length>1 || !activeFocus({...state,tasks:after},now))delete state.scheduleFocus;
}
export function followupActions(state,text,now=Date.now()) {
  const draft=activeDraft(state,now),focus=draft?null:activeFocus(state,now);
  const item=draft?.items.length===1?draft.items[0]:focus;
  if(!item?.title || !item.date)return null;
  const clock=/(上午|下午|晚上|中午|早上)?\s*([0-9零〇一二两三四五六七八九十]{1,3})(?:[:：]([0-9]{2})|点(半|[0-9零〇一二两三四五六七八九十]{1,3}分?)?)/g;
  const matches=[...text.matchAll(clock)];
  if(!matches.length || text.replace(clock,'').replace(/(?:不对|啊不|改成|改为|改到|换成|应该是|还是|吧|钟|啊|嗯|不|[\s，,。.!！…])/g,''))return null;
  const number=value=>{
    if(/^\d+$/.test(value))return Number(value);
    const digits={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
    if(value.includes('十')){const [tens,ones]=value.split('十');return (tens?digits[tens]:1)*10+(ones?digits[ones]:0);}
    return digits[value];
  };
  const match=matches.at(-1);
  const period=match[1] || matches.findLast(value=>value[1])?.[1] || item.period || (focus?(Number(focus.time.slice(0,2))>=12?'下午':'上午'):null);
  let hour=number(match[2]);const minute=match[3]?Number(match[3]):match[4]==='半'?30:match[4]?number(match[4].replace(/分$/,'')):0;
  if(!Number.isInteger(hour)||hour>23||!Number.isInteger(minute)||minute>59 || (hour<12&&!period))return null;
  if((['下午','晚上'].includes(period)&&hour<12)||(period==='中午'&&hour<11))hour+=12;
  const time=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  return draft?{actions:[{type:'create',title:item.title,date:item.date,time,duration:30}],draft:null}:{actions:[{type:'update',query:focus.id,time}]};
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
function correctedTitle(previous,title,text) {
  const verbs=/^(整理|准备|购买|买|提交|写|修改|打印|领取|取|发送|发|参加|预约|检查|收集|完成)/;
  const action=previous?.match(verbs)?.[0];
  return action && title===text.trim().replace(/[。！!]+$/,'') && !verbs.test(title)?action+title:title;
}
export function cleanInterpretation(value, now=Date.now(), draft=null, tasks=[], text='') {
  if (!Array.isArray(value?.actions) || value.actions.length>10)throw new Error('invalid_actions');
  let nextDraft=value.draft!==undefined?cleanDraft(value.draft,now):undefined;
  if(draft?.items.length===1 && nextDraft?.items.length===1 && nextDraft.items[0].title)nextDraft.items[0].title=correctedTitle(draft.items[0].title,nextDraft.items[0].title,text);
  const ready=(nextDraft?.items || []).filter(item=>item.title && item.date && item.time);
  let actions=value.actions.map(action=>{
    if (action.type==='create') {
      const task=safeTask({...action,id:'validation',status:'pending'});
      return {type:'create',title:task.title,date:task.date,time:task.time,duration:task.duration};
    }
    if (action.type==='clarify' && typeof action.question==='string')return {type:'clarify',question:action.question.slice(0,300)};
    if (action.type==='list')return {type:'list',...(action.date && validDate(action.date)?{date:action.date}:{})};
    if(action.type==='update' && typeof action.query==='string' && action.query.trim()) {
      const changes=Object.fromEntries(['title','date','time'].filter(key=>action[key]!==undefined).map(key=>[key,action[key]]));
      if(!Object.keys(changes).length)throw new Error('empty_update');
      let matches=tasks.filter(task=>task.status==='pending' && (task.id===action.query || task.title===action.query));
      if(!matches.length)matches=tasks.filter(task=>task.status==='pending' && text.includes(task.title));
      if(changes.title && matches.length===1)changes.title=correctedTitle(matches[0].title,changes.title,text);
      const task=safeTask({id:'validation',title:'修改',date:'2000-01-01',time:'00:00',status:'pending',...changes});
      return {type:'update',query:matches.length===1?matches[0].id:action.query.slice(0,200),...Object.fromEntries(Object.keys(changes).map(key=>[key,task[key]]))};
    }
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
  if(draft?.items.length===1 && nextDraft?.items.length===1 && draft.items[0].title!==nextDraft.items[0].title) {
    for(const action of actions)if(action.type==='clarify' && !action.question.includes(nextDraft.items[0].title))action.question=`已更正为“${nextDraft.items[0].title}”。${action.question}`;
  }
  if(draft && value.draft==null && !actions.some(action=>action.type==='create' && draft.items.some(item=>item.title===action.title)))return {actions};
  return {actions,...(value.draft!==undefined?{draft:nextDraft}:actions.some(action=>action.type==='clarify')?{}:{draft:null})};
}
