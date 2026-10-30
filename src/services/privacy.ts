// Explicit allowlists: new modules must never become cloud data implicitly.
export const SCHEDULE_SYNC_KEYS = new Set([
  'wb.tasks.v1', 'wb.records.v1', 'wb.categories.v1',
])
export function canSyncKey(key: string): boolean { return SCHEDULE_SYNC_KEYS.has(key) }
export function canExportKey(key: string): boolean {
  return key.startsWith('wb.') && !/^wb\.(sync|assistant)\./.test(key)
}

const FIELDS: Record<string, string[]> = {
  'wb.tasks.v1': ['id','title','categoryId','emoji','scheduledTime','scheduledDate','duration','recurrence','weekdays','monthDay','priority','reminderEnabled','reminderLead','target','unit','isQuick','createdAt','updatedAt','archivedAt'],
  'wb.records.v1': ['id','taskId','taskTitle','categoryId','date','startedAt','completedAt','durationSeconds','progress','progressTotal','isMakeup','makeupAt'],
  'wb.categories.v1': ['id','name','emoji','icon','color','timeRange','order'],
}
export function scheduleOnlyValue(key: string, value: string): string {
  if (!canSyncKey(key)) throw new Error('Key is not allowed to sync')
  const items = JSON.parse(value)
  if (!Array.isArray(items)) throw new Error('Expected a schedule array')
  return JSON.stringify(items.map(item => Object.fromEntries(FIELDS[key]
    .filter(field => item && Object.prototype.hasOwnProperty.call(item,field)).map(field => [field,item[field]]))))
}
export function preservePrivateFields(key: string, incoming: string, existing: string | null): string {
  const safe = JSON.parse(scheduleOnlyValue(key,incoming))
  let local: any[] = []
  try { local = JSON.parse(existing || '[]') } catch { /* Invalid legacy data is not uploaded. */ }
  const field = key === 'wb.tasks.v1' ? 'description' : key === 'wb.records.v1' ? 'note' : null
  if (field) for (const item of safe) {
    const prior = local.find(old=>old.id===item.id)
    if (prior && Object.prototype.hasOwnProperty.call(prior,field)) item[field]=prior[field]
  }
  return JSON.stringify(safe)
}
