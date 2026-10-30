export function cstDay(now = Date.now()) {
  return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function safeTask(input) {
  if (!input || typeof input !== 'object' || typeof input.id !== 'string'
      || !/^[\w-]{1,100}$/.test(input.id) || typeof input.title !== 'string'
      || !input.title.trim() || input.title.length > 200
      || !validDate(input.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')
      || !['pending', 'completed', 'cancelled'].includes(input.status)) {
    throw new Error('invalid_task');
  }
  return { id: input.id, title: input.title.trim(), date: input.date, time: input.time,
    status: input.status, duration: Math.max(1, Math.min(1440, Number(input.duration) || 30)),
    completedAt: input.status === 'completed' ? Number(input.completedAt) || Date.now() : null };
}
export function resolveTask(tasks, query) {
  if (!query) return { error: '请说出任务名称，例如“写报告完成了”。' };
  const candidates = tasks.filter(task => task.status === 'pending');
  const exact = candidates.filter(task => task.id === query || task.title === query);
  const matches = exact.length ? exact : candidates.filter(task => task.title.includes(query));
  if (matches.length === 1) return { task: matches[0] };
  return { error: matches.length ? `找到多项任务，请补充完整名称：\n${matches.map(t => `${t.date} ${t.time} ${t.title}`).join('\n')}`
    : '没有找到对应的未完成任务，请补充任务名称。' };
}
export function applyActions(tasks, actions, now = Date.now(), sourceId = 'manual') {
  const next = tasks.map(task => ({ ...task }));
  const replies = [];
  for (let index = 0; index < Math.min(actions.length, 10); index++) {
    const action = actions[index];
    if (action.type === 'list') {
      const day = action.date || cstDay(now);
      const today = next.filter(t => t.date === day && t.status !== 'cancelled').sort((a,b) => a.time.localeCompare(b.time));
      replies.push(today.length ? `${day} 的安排：\n${today.map(t => `${t.status === 'completed' ? '✅' : '□'} ${t.time} ${t.title}`).join('\n')}` : `${day} 还没有日程。`);
    } else if (action.type === 'create') {
      const id = `wx-${sourceId.replace(/[^\w-]/g, '').slice(0,60)}-${index}`;
      if (next.some(task => task.id === id)) continue;
      try {
        const task = safeTask({ ...action, id, status: 'pending' });
        next.push({ ...task, version: 1, updatedAt: now });
        replies.push(`已记录：${task.date} ${task.time} ${task.title}`);
      } catch { replies.push('日期或时间不明确，请补充，例如“明天下午3点写报告”。'); }
    } else if (['complete', 'cancel', 'reschedule'].includes(action.type)) {
      const result = resolveTask(next, action.taskId || action.query);
      if (result.error) { replies.push(result.error); continue; }
      const task = result.task;
      if (action.type === 'reschedule') {
        try { Object.assign(task, safeTask({ ...task, date: action.date, time: action.time })); }
        catch { replies.push('改期时间不明确，请补充日期和具体时间。'); continue; }
      } else {
        task.status = action.type === 'complete' ? 'completed' : 'cancelled';
        task.completedAt = action.type === 'complete' ? now : null;
      }
      task.version++; task.updatedAt = now;
      replies.push(`${action.type === 'complete' ? '✅ 已完成' : action.type === 'cancel' ? '已取消' : '已改期'}：${task.title}`);
    } else if (action.type === 'clarify' && typeof action.question === 'string') {
      replies.push(action.question.slice(0,300));
    }
  }
  return { tasks: next, reply: replies.join('\n') || '请告诉我任务内容和时间。' };
}

export function ruleActions(text, now = Date.now()) {
  if (/^(今天|今日)(的)?(任务|安排|日程)[？?]?$/.test(text)) return [{ type: 'list' }];
  const completed = text.match(/^(.+?)(?:已经|已)?(?:完成了|做完了|搞定了|完成|做完)[！!。]?$/);
  if (completed) return [{ type: 'complete', query: completed[1].trim() }];
  // Strict free fallback: require an explicit day, hour and a nonempty title.
  const actions = [];
  for (const part of text.split(/[，,；;\n]+/)) {
    const match = part.trim().match(/^(今天|明天|后天|\d{4}-\d{2}-\d{2})\s*(上午|下午|晚上|中午|早上)?\s*(\d{1,2})(?:[:：](\d{2})|点(半|\d{1,2}分?)?)?\s*(.+)$/);
    if (!match) return [];
    let hour = Number(match[3]);
    const minute = match[4] ? Number(match[4]) : match[5] === '半' ? 30 : parseInt(match[5] || '0',10);
    if (['下午','晚上'].includes(match[2]) && hour < 12) hour += 12;
    if (match[2] === '中午' && hour < 11) hour += 12;
    const offset = { 今天: 0, 明天: 1, 后天: 2 }[match[1]];
    actions.push({ type: 'create', title: match[6].replace(/^提醒我\s*/,''),
      date: offset === undefined ? match[1] : cstDay(now + offset * 86400000),
      time: `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` });
  }
  return actions;
}
