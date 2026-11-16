import { dt, fmtDate } from './date'

export function isNextDay(date: Date, occurrence: string) {
  return fmtDate(dt.subDays(date,1)) === occurrence
}

export function checkInTimes(date: string, start: string, end: string) {
  const startedAt = new Date(`${date}T${start}:00`).getTime()
  const endDate = new Date(`${date}T${end}:00`)
  const completedAt = (end < start ? dt.addDays(endDate,1) : endDate).getTime()
  return { startedAt, completedAt, durationSeconds: Math.max(0,Math.round((completedAt-startedAt)/1000)) }
}

export function checkInClock(timestamp: number, occurrence: string) {
  const date = new Date(timestamp)
  return dt.format(date,'HH:mm') + (isNextDay(date,occurrence) ? '⁺' : '')
}
