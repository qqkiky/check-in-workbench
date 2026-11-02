import { validDate } from './domain.mjs';

// Only recurring/untimed agenda fields cross this boundary, never notes or finance.
export function safeAgenda(tasks) {
  if(!Array.isArray(tasks)||tasks.length>2000)throw new Error('invalid_agenda');
  const ids=new Set();
  return tasks.map(task=>{
    if(!task||typeof task.id!=='string'||!/^[\w-]{1,100}$/.test(task.id)||ids.has(task.id)
      ||typeof task.title!=='string'||!task.title.trim()||task.title.length>200
      ||!['none','daily','weekly','monthly'].includes(task.recurrence)
      ||!(task.date===''||validDate(task.date))||!validDate(task.createdDate)
      ||!(task.time===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time))
      ||typeof task.completed!=='boolean')throw new Error('invalid_agenda_task');
    ids.add(task.id);
    const dates=key=>{
      if(!Array.isArray(task[key])||task[key].length>10000||task[key].some(day=>!validDate(day)))throw new Error('invalid_agenda_dates');
      return [...new Set(task[key])].sort();
    };
    if(!Array.isArray(task.weekdays)||task.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)
      ||!Number.isInteger(task.monthDay)||task.monthDay<0||task.monthDay>31
      ||task.recurrence==='monthly'&&task.monthDay===0)throw new Error('invalid_agenda_repeat');
    return {id:task.id,title:task.title.trim(),date:task.date,time:task.time,createdDate:task.createdDate,
      recurrence:task.recurrence,weekdays:[...new Set(task.weekdays)].sort(),monthDay:task.monthDay,
      excludedDates:dates('excludedDates'),completedDates:dates('completedDates'),completed:task.completed};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}

export function dailyPending(schedules,agenda,day) {
  const rows=new Map(schedules.filter(task=>task.date===day&&task.status==='pending').map(task=>[task.id,task]));
  const date=new Date(day+'T00:00:00Z');
  for(const task of agenda) {
    rows.delete(task.id);
    if(task.excludedDates.includes(day)||task.completedDates.includes(day))continue;
    const occurs=task.recurrence==='daily'
      ||task.recurrence==='weekly'&&(!task.weekdays.length||task.weekdays.includes(date.getUTCDay()))
      ||task.recurrence==='monthly'&&task.monthDay===date.getUTCDate()
      ||task.recurrence==='none'&&!task.completed&&(task.date?task.date===day:task.createdDate<=day);
    if(occurs)rows.set(task.id,{id:task.id,title:task.title,date:day,time:task.time,status:'pending'});
  }
  return [...rows.values()].sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||a.id.localeCompare(b.id));
}

export function agendaLines(rows) {
  return rows.map(task=>`${task.time||'时间未定'} ${task.title}`).join('\n');
}
