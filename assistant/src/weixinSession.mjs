export function connectionStatus(state) {
  return state.botToken && state.connectionStatus === 'connected' ? 'connected'
    : state.botToken ? 'checking' : 'disconnected';
}
export function revokedWeixin(error) {
  return /^weixin_(request_rejected_-14|http_401)$/.test(error?.message || '');
}
export function disconnectWeixin(state) {
  for (const key of ['botToken','owner','contextToken','baseUrl','qr','qrAt','scheduleFocus']) delete state[key];
  state.cursor='';state.outbox=[];state.connectionStatus='disconnected';
  state.remindersPaused=true;state.deliveryError=false;
}
export function freshOutbound(state,item,now=Date.now()) {
  if (!state.botToken || connectionStatus(state)!=='connected') return null;
  if(item.key.startsWith('reminder-')) {
    const task=state.tasks.find(task=>task.id===item.taskId);
    if(state.remindersPaused || !task || task.status!=='pending' || task.reminderEnabled===false
      || task.version!==item.taskVersion || task.date!==new Date(now+8*3600000).toISOString().slice(0,10))return null;
  }
  return item;
}
