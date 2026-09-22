import React, { useEffect, useState } from 'react'
import { Icons } from '@/components/common/Icons'

type Item = {
  title: string
  summary?: string
  url: string
  source?: string
  date?: string
  lang?: 'zh' | 'en'
  titleZh?: string
  zhSummary?: string
  topic?: string
}

type SectionKey = 'industry' | 'drug' | 'regulatory'

type BriefData = {
  generatedAt?: string
  sections: Record<SectionKey, Item[]>
}

type MonthEntry = {
  month: string
  overview?: string
  keyPoints?: string[]
  sections: Record<SectionKey, Item[]>
}

type MonthlyData = {
  generatedAt?: string
  months: Record<string, MonthEntry>
}

type ModuleKey = SectionKey | 'monthly'

const SECTION_META: { key: SectionKey; label: string; icon: React.ReactNode; accent: string }[] = [
  {
    key: 'industry',
    label: '行业动态',
    icon: <Icons.Newspaper size={16} />,
    accent: 'bg-sky-50 text-sky-600',
  },
  {
    key: 'drug',
    label: '药品信息',
    icon: <Icons.Pill size={16} />,
    accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    key: 'regulatory',
    label: '监管动态',
    icon: <Icons.Shield size={16} />,
    accent: 'bg-amber-50 text-amber-600',
  },
]

const MODULES: { key: ModuleKey; label: string; icon: React.ReactNode }[] = [
  ...SECTION_META.map((s) => ({ key: s.key, label: s.label, icon: s.icon })),
  { key: 'monthly', label: '每月资讯', icon: <Icons.Calendar size={16} /> },
]

function currentMonthKey() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}`
}

function itemMonth(it: Item) {
  return (it.date || '').slice(0, 7) // YYYY-MM
}

function fmtDateTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 单条资讯卡片：外文条目展示中文译文 + 核心要点 + 原文标题 */
function ItemCard({ it }: { it: Item }) {
  const isEn = it.lang === 'en'
  return (
    <a
      href={it.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-2xl shadow-card p-3 active:scale-[0.99] transition-transform"
    >
      {isEn ? (
        <>
          <div className="text-[13px] font-semibold text-gray-900 leading-snug">
            {it.titleZh || it.title}
          </div>
          {it.zhSummary && (
            <div className="text-[11px] text-gray-700 mt-1.5 leading-relaxed bg-amber-50 rounded-lg p-2 border border-amber-100">
              <span className="text-[10px] text-amber-600 font-semibold">核心要点 · </span>
              {it.zhSummary}
            </div>
          )}
          {it.title && it.titleZh && (
            <div className="text-[10px] text-gray-400 mt-1.5 line-clamp-1">原文：{it.title}</div>
          )}
        </>
      ) : (
        <>
          <div className="text-[13px] font-medium text-gray-900 leading-snug">{it.summary ? it.title : it.title}</div>
          {it.summary && (
            <div className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-3">{it.summary}</div>
          )}
        </>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {it.source && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{it.source}</span>
        )}
        {it.date && <span className="text-[10px] text-gray-400">{it.date}</span>}
        {isEn && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600">译</span>}
        <span className="text-[10px] text-primary ml-auto flex items-center gap-0.5">
          来源 <Icons.ArrowUpRight size={11} />
        </span>
      </div>
    </a>
  )
}

function SectionHeader({ sec, count }: { sec: (typeof SECTION_META)[number]; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${sec.accent}`}>
        {sec.icon}
      </span>
      <h2 className="text-sm font-semibold text-gray-900">{sec.label}</h2>
      <span className="text-[11px] text-gray-400">{count}</span>
    </div>
  )
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <span className="text-gray-300 mb-3">{icon}</span>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

export function InfoScreen() {
  const [module, setModule] = useState<ModuleKey>('industry')

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <h1 className="text-xl font-bold text-gray-900">资讯</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">宠物与医药行业 · 行业动态 / 药品信息 / 监管动态 / 每月资讯</p>
      </header>

      {/* 模块切换 / 选项卡 */}
      <div className="px-3 pb-2 bg-[#F2F2F7]">
        <div className="flex bg-gray-200/70 rounded-xl p-1 gap-1">
          {MODULES.map((m) => (
            <button
              key={m.key}
              onClick={() => setModule(m.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                module === m.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >
              {m.icon}
              <span className="whitespace-nowrap">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <ModuleErrorBoundary>
        {module === 'industry' && <SectionModule sectionKey="industry" />}
        {module === 'drug' && <SectionModule sectionKey="drug" />}
        {module === 'regulatory' && <SectionModule sectionKey="regulatory" />}
        {module === 'monthly' && <MonthlyModule />}
      </ModuleErrorBoundary>
    </div>
  )
}

/** 模块级错误边界：任一模块渲染异常时只降级该模块，不影响 Tab 切换与整体可用性 */
class ModuleErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err: unknown) {
    console.error('[InfoScreen] module crashed:', err)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center px-8 py-16 text-center">
          <div>
            <p className="text-sm text-gray-500">该模块加载出现异常</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-3 text-[12px] px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 active:scale-95 transition-transform"
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function useJson<T>(file: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    fetch(file + '?t=' + Date.now(), { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('http ' + r.status)
        return r.json()
      })
      .then((j) => {
        if (!alive) return
        setData(j)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setError(true)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [file])
  return { data, loading, error }
}

/** 内容模块（行业动态 / 药品信息 / 监管动态）：仅展示当月内容，外文内联译文与要点 */
function SectionModule({ sectionKey }: { sectionKey: SectionKey }) {
  const meta = SECTION_META.find((s) => s.key === sectionKey)!
  const { data, loading, error } = useJson<BriefData>('consult-data.json')
  const cur = currentMonthKey()
  const all = data?.sections?.[sectionKey] || []
  const items = all.filter((it) => itemMonth(it) === cur)
  const total = all.length
  const monthCount = items.length

  return (
    <div className="flex-1 overflow-y-auto pb-24 px-3 space-y-3">
      <div className="flex items-center gap-2 px-1 pt-1">
        <SectionHeader sec={meta} count={monthCount} />
        <span className="ml-auto text-[10px] text-gray-400">
          {cur} · 累计 {total}
        </span>
      </div>

      {loading && <CenterLoading />}
      {!loading && error && (
        <EmptyState
          icon={<Icons.CloudOff size={40} />}
          title="暂未获取到资讯内容"
          sub="每日 08:00 自动更新，请联网后重试"
        />
      )}
      {!loading && !error && monthCount === 0 && (
        <EmptyState
          icon={meta.icon}
          title={`${cur} 暂无${meta.label}更新`}
          sub="往期内容可在「每月资讯」中查看"
        />
      )}
      {!loading && !error && monthCount > 0 && (
        <div className="space-y-2">
          {items.map((it, i) => (
            <ItemCard key={i} it={it} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 每月资讯：按月压缩归档，可展开查看当月概览与要点 */
function MonthlyModule() {
  const { data, loading, error } = useJson<MonthlyData>('monthly-summary.json')
  const [open, setOpen] = useState<string | null>(null)

  const months = data
    ? Object.values(data.months).sort((a, b) => b.month.localeCompare(a.month))
    : []

  return (
    <div className="flex-1 overflow-y-auto pb-24 px-3 space-y-3">
      <p className="text-[11px] text-gray-400 px-1 pt-1">
        {loading ? '加载中…' : error ? '月报加载失败，请检查网络后重试' : `共 ${months.length} 个月归档 · 每次更新累积、按月压缩`}
      </p>

      {loading && <CenterLoading />}
      {!loading && error && (
        <EmptyState icon={<Icons.CloudOff size={40} />} title="月报尚未生成" sub="每日更新后将自动按月汇总" />
      )}
      {!loading && !error && months.length === 0 && (
        <EmptyState icon={<Icons.Calendar size={40} />} title="暂无月度归档" sub="每日更新后将自动按月压缩" />
      )}
      {!loading && !error && months.length > 0 && (
        <div className="space-y-2">
          {months.map((m) => {
            const total = sumLen(m.sections)
            const isOpen = open === m.month
            return (
              <div key={m.month} className="bg-white rounded-2xl shadow-card overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : m.month)}
                  className="w-full flex items-center gap-2 p-3 active:scale-[0.99] transition-transform"
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600">
                    <Icons.Calendar size={16} />
                  </span>
                  <div className="text-left flex-1">
                    <div className="text-[13px] font-semibold text-gray-900">{m.month} 月度资讯</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      行业 {(m.sections?.industry || []).length} · 药品 {(m.sections?.drug || []).length} · 监管 {(m.sections?.regulatory || []).length}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {isOpen ? '收起' : '展开'} <Icons.ChevronDown size={14} className={isOpen ? 'rotate-180 inline' : 'inline'} />
                  </span>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100">
                    {m.overview && (
                      <p className="text-[12px] text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-2.5">
                        {m.overview}
                      </p>
                    )}
                    {m.keyPoints && m.keyPoints.length > 0 && (
                      <div>
                        <h3 className="text-[11px] font-semibold text-gray-500 mb-1.5">本月核心要点</h3>
                        <ul className="space-y-1.5">
                          {m.keyPoints.map((k, i) => (
                            <li key={i} className="flex gap-2 text-[12px] text-gray-600 leading-relaxed">
                              <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                              {k}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="space-y-3">
                      {SECTION_META.map((sec) => {
                        const items = (m.sections[sec.key] || []).filter((it) => it && it.url)
                        if (items.length === 0) return null
                        return (
                          <div key={sec.key}>
                            <SectionHeader sec={sec} count={items.length} />
                            <div className="space-y-2">
                              {items.map((it, i) => (
                                <ItemCard key={i} it={it} />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function sumLen(sections: Record<SectionKey, Item[]>) {
  return (
    (sections?.industry?.length || 0) +
    (sections?.drug?.length || 0) +
    (sections?.regulatory?.length || 0)
  )
}

function CenterLoading() {
  return <div className="flex items-center justify-center py-16 text-gray-400 text-sm">加载中…</div>
}
