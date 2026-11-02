import { useState } from 'react'
import { Modal } from './common/Modal'
import { showToast } from './common/Toast'
import { getCalendarSources, setCalendarSources, type CalendarSource } from '@/capacitor/task-calendar'

export function CalendarSourcesSettings() {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [calendars,setCalendars]=useState<CalendarSource[]>([]),[selected,setSelected]=useState<number[]>([])
  const [loaded,setLoaded]=useState(false)
  async function load() {
    setOpen(true);setBusy(true);setError('');setLoaded(false)
    try{const rows=await getCalendarSources();setCalendars(rows);setSelected(rows.filter(row=>row.selected).map(row=>row.id));setLoaded(true)}
    catch(error){setError(error instanceof Error?error.message:'无法读取日历')}
    finally{setBusy(false)}
  }
  async function save() {
    setBusy(true);setError('')
    try{const report=await setCalendarSources(selected);setOpen(false);showToast(`小爱日历来源已保存：导入 ${report.importedTasks} 项，更新 ${report.updatedTasks} 项`)}
    catch(error){setError(error instanceof Error?error.message:'同步失败，请重试')}
    finally{setBusy(false)}
  }
  return <>
    <button onClick={()=>void load()} className="w-full bg-white rounded-2xl shadow-card p-4 text-left">
      <span className="block text-sm font-medium">小爱日历导入</span>
      <span className="block text-xs text-gray-500 mt-1">选择小爱写入的日历，自动接收新增和修改</span>
    </button>
    <Modal open={open} onClose={()=>{if(!busy)setOpen(false)}} title="选择小爱使用的日历">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">选择小爱新增事项所在的日历。导入今天及以后的单次日程，支持全天事项；重复日程暂不导入。</p>
        <p className="text-xs text-gray-500">所选日程的标题、日期和提醒会进入期待，标题也会进入微信清单。日历备注不导入。取消选择不会删除已导入的待办。</p>
        {busy&&<p role="status" className="text-sm text-gray-500">正在读取或同步…</p>}
        {calendars.map(calendar=><label key={calendar.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
          <input type="checkbox" disabled={busy} checked={selected.includes(calendar.id)} onChange={event=>{const checked=event.currentTarget.checked;setSelected(previous=>checked?[...previous,calendar.id]:previous.filter(id=>id!==calendar.id))}}/>
          <span className="min-w-0 text-sm break-words">{calendar.name||'未命名日历'}<span className="block text-xs text-gray-400">{calendar.account}</span></span>
        </label>)}
        {!busy&&!calendars.length&&!error&&<p className="text-sm text-gray-500">尚未找到其他可写日历。可以先让小爱新增一条测试日程，再重新打开这里。</p>}
        {error&&<p role="alert" className="text-sm text-red-600 break-words">{error}</p>}
        <button disabled={busy||!loaded} onClick={()=>void save()} className="w-full p-3 rounded-xl bg-primary text-white disabled:opacity-40">保存来源并同步</button>
      </div>
    </Modal>
  </>
}
