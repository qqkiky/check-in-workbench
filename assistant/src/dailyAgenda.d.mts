export interface AgendaTask {
  id:string;title:string;date:string;time:string;createdDate:string;
  recurrence:'none'|'daily'|'weekly'|'monthly';weekdays:number[];monthDay:number;
  excludedDates:string[];completedDates:string[];completed:boolean;
}
export function safeAgenda(tasks:unknown):AgendaTask[];
export function dailyPending(schedules:Array<{id:string;title:string;date:string;time:string;status:string}>,agenda:AgendaTask[],day:string):Array<{id:string;title:string;date:string;time:string;status:string}>;
export function agendaLines(rows:Array<{title:string;time:string}>):string;
