import { useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { CheckInRecord, Category, TimelineEntry } from '@/types'
import { CategoryIcon } from '@/utils/iconLibrary'
import { secondsToCompact } from '@/utils/date'
import { timelineDurationSeconds } from '@/utils/timeline'
import { Icons } from '@/components/common/Icons'
import { StatsLineChart } from '@/components/charts/StatsLineChart'
import { CategoryDonut } from '@/components/charts/CategoryDonut'

interface Props {
  records: CheckInRecord[]
  categories: Category[]
  entries: TimelineEntry[]
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

// 年度复盘：按 durationSeconds 汇总全年时长，展示分类占比环形图与月度堆叠柱状图
export function AnnualReview({ records, categories, entries }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const yStr = String(year)

  const { totalSeconds, totalCount, activeDays, categoryData, timelineByCat, timelineTotalSec, monthlyData, monthlyCount, yearRecords } = useMemo(() => {
    const yr = records.filter((r) => r.date.startsWith(yStr))
    const totalSec = yr.reduce((s, r) => s + (r.durationSeconds || 0), 0)
    const days = new Set(yr.map((r) => r.date)).size

    // 分类时长汇总
    const catMap: Record<string, number> = {}
    yr.forEach((r) => {
      catMap[r.categoryId] = (catMap[r.categoryId] || 0) + (r.durationSeconds || 0)
    })
    const catData = categories
      .map((c) => ({ id: c.id, name: c.name, color: c.color, value: catMap[c.id] || 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)

    // 月度堆叠：每月各分类时长
    const md: Record<string, number | string>[] = Array.from({ length: 12 }, (_, i) => {
      const o: Record<string, number | string> = { month: `${i + 1}月` }
      categories.forEach((c) => (o[c.name] = 0))
      return o
    })
    yr.forEach((r) => {
      const m = parseInt(r.date.slice(5, 7), 10) - 1
      const cat = categories.find((c) => c.id === r.categoryId)
      const name = cat?.name || '其他'
      md[m][name] = ((md[m][name] as number) || 0) + (r.durationSeconds || 0)
    })

    // 本年每月打卡次数（供折线图）
    const mc: { date: string; count: number }[] = Array.from({ length: 12 }, (_, i) => ({
      date: `${yStr}-${String(i + 1).padStart(2, '0')}-01`,
      count: 0,
    }))
    yr.forEach((r) => {
      const m = parseInt(r.date.slice(5, 7), 10) - 1
      mc[m].count += 1
    })

    // 时间线分类时长汇总（按 startTime/endTime 计算，支持跨天）
    const tlMap: Record<string, number> = {}
    entries.forEach((e) => {
      if (!e.categoryId || !e.endTime) return
      const sec = timelineDurationSeconds(e.startTime, e.endTime)
      tlMap[e.categoryId] = (tlMap[e.categoryId] || 0) + sec
    })
    const timelineByCat = categories
      .map((c) => ({ id: c.id, name: c.name, color: c.color, value: tlMap[c.id] || 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
    const timelineTotalSec = Object.values(tlMap).reduce((a, b) => a + b, 0)

    return {
      totalSeconds: totalSec,
      totalCount: yr.length,
      activeDays: days,
      categoryData: catData,
      timelineByCat,
      timelineTotalSec,
      monthlyData: md,
      monthlyCount: mc,
      yearRecords: yr,
    }
  }, [records, categories, entries, yStr])

  const pieData = categoryData.map((d) => ({ name: d.name, value: d.value, color: d.color }))
  const totalHours = totalSeconds / 3600
  const maxCat = categoryData[0]

  const yAxisFmt = (v: number) => {
    if (v >= 3600) return `${(v / 3600).toFixed(0)}h`
    if (v >= 60) return `${(v / 60).toFixed(0)}m`
    return `${v}s`
  }

  return (
    <div className="px-3 py-3 space-y-3">
      {/* 年份切换 */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="w-8 h-8 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95"
          aria-label="上一年"
        >
          <Icons.ChevronLeft size={16} />
        </button>
        <div className="text-lg font-bold text-gray-900">{year} 年度复盘</div>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="w-8 h-8 rounded-full bg-white shadow-card flex items-center justify-center text-gray-600 active:scale-95"
          aria-label="上一年份"
        >
          <Icons.ChevronRight size={16} />
        </button>
      </div>

      {/* 总览数字 */}
      <div className="bg-white rounded-2xl p-4 shadow-card grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {totalHours.toFixed(1)}
            <span className="text-xs font-normal text-gray-500 ml-0.5">小时</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">年度总时长</div>
        </div>
        <div className="text-center border-l border-r border-gray-100">
          <div className="text-2xl font-bold text-gray-900">
            {totalCount}
            <span className="text-xs font-normal text-gray-500 ml-0.5">次</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">打卡次数</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {activeDays}
            <span className="text-xs font-normal text-gray-500 ml-0.5">天</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">活跃天数</div>
        </div>
      </div>

      {/* 本年每月打卡次数折线图 */}
      <div className="bg-white rounded-2xl p-4 shadow-card">
        <h3 className="text-sm font-semibold mb-3">本年每月打卡次数</h3>
        {totalCount === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">今年还没有打卡记录</div>
        ) : (
          <StatsLineChart data={monthlyCount} />
        )}
        <p className="mt-1 text-[10px] text-gray-400 text-center">折线展示每月打卡总次数走势</p>
      </div>

      {/* 分类打卡次数占比环形图 */}
      <div className="bg-white rounded-2xl p-4 shadow-card">
        <h3 className="text-sm font-semibold mb-3">分类打卡次数占比</h3>
        <CategoryDonut records={yearRecords} categories={categories} />
      </div>

      {/* 分类时长占比环形图 */}
      <div className="bg-white rounded-2xl p-4 shadow-card">
        <h3 className="text-sm font-semibold mb-1">分类时长占比</h3>
        {categoryData.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">今年还没有带时长的打卡记录</div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={66}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-gray-900">{totalHours.toFixed(1)}h</span>
                <span className="text-[10px] text-gray-400">年度总时长</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {categoryData.slice(0, 6).map((c) => {
                const pct = totalSeconds > 0 ? Math.round((c.value / totalSeconds) * 100) : 0
                return (
                  <div key={c.id} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: c.color }}
                    />
                    <span className="flex-1 truncate text-gray-700">{c.name}</span>
                    <span className="text-gray-500">{secondsToCompact(c.value)}</span>
                    <span className="text-gray-400 w-9 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {maxCat && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
            <CategoryIcon category={categories.find((c) => c.id === maxCat.id) || { emoji: '📌' }} size={13} color={maxCat.color} />
            投入最多：{maxCat.name} {secondsToCompact(maxCat.value)}
          </div>
        )}
      </div>

      {/* 时间线分类 vs 打卡分类 时间投入 */}
      <div className="bg-white rounded-2xl p-4 shadow-card">
        <h3 className="text-sm font-semibold mb-1">时间线分类 vs 打卡分类 时间投入</h3>
        <p className="text-[10px] text-gray-400 mb-3">分别统计「时间线记事」与「打卡任务」各自消耗的总时长</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
              <span className="text-[12px] font-medium text-gray-700">打卡分类</span>
              <span className="ml-auto text-[12px] font-bold text-gray-900 tabular-nums">{secondsToCompact(totalSeconds)}</span>
            </div>
            <div className="space-y-1">
              {categoryData.length === 0 ? (
                <div className="text-[11px] text-gray-400">暂无带时长的打卡</div>
              ) : (
                categoryData.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="flex-1 truncate text-gray-600">{c.name}</span>
                    <span className="text-gray-400 tabular-nums">{secondsToCompact(c.value)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icons.Edit size={13} className="text-blue-500" />
              <span className="text-[12px] font-medium text-gray-700">时间线分类</span>
              <span className="ml-auto text-[12px] font-bold text-gray-900 tabular-nums">{secondsToCompact(timelineTotalSec)}</span>
            </div>
            <div className="space-y-1">
              {timelineByCat.length === 0 ? (
                <div className="text-[11px] text-gray-400">暂无带时长的记事</div>
              ) : (
                timelineByCat.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="flex-1 truncate text-gray-600">{c.name}</span>
                    <span className="text-gray-400 tabular-nums">{secondsToCompact(c.value)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-card">
        <h3 className="text-sm font-semibold mb-3">各月时长分布</h3>
        {totalSeconds === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">暂无数据</div>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#8E8E93' }}
                  axisLine={{ stroke: '#E5E5EA' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#8E8E93' }}
                  tickFormatter={yAxisFmt}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(value: number) => [secondsToCompact(value), '时长']}
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#1C1C1E', fontWeight: 600 }}
                />
                {categoryData.map((c) => (
                  <Bar
                    key={c.id}
                    dataKey={c.name}
                    stackId="duration"
                    fill={c.color}
                    maxBarSize={20}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[10px] text-gray-400 text-center">柱体按分类颜色堆叠，高度代表当月总投入时长</p>
      </div>
    </div>
  )
}
