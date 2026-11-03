export function effectiveAgenda(state:any):any[];
export function conversationTasks(state:any,now?:number):any[];
export function applyConversationActions(state:any,actions:any[],now?:number,sourceId?:string):{tasks:any[];reply:string;focusId?:string};
