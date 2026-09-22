import { useEffect, useState } from 'react'
import { Icons } from '@/components/common/Icons'

type Item = {
  title: string
  summary?: string
  url: string
  source?: string
  date?: string
}

type ConsultData = {
  generatedAt?: string
  sections: {
    industry: Item[]
    drug: Item[]
    regulatory: Item[]
  }
}

const SECTION_META: { key: keyof ConsultData['sections']; label: string; icon: React.ReactNode; accent: string }[] = [
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

function fmtGeneratedAt(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ConsultScreen() {
  const [data, setData] = useState<ConsultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('consult-data.json?t=' + Date.now(), { cache: 'no-store' })
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
  }, [])

  const total =
    data && data.sections
      ? data.sections.industry.length + data.sections.drug.length + data.sections.regulatory.length
      : 0

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 bg-[#F2F2F7]">
        <h1 className="text-xl font-bold text-gray-900">咨询</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {loading
            ? '加载中…'
            : error
              ? '内容加载失败，请检查网络后下拉刷新'
              : data?.generatedAt
                ? `更新于 ${fmtGeneratedAt(data.generatedAt)} · 共 ${total} 条`
                : '宠物与医药行业每日资讯'}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto pb-24 px-3 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">加载中…</div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <span className="text-gray-300 mb-3"><Icons.CloudOff size={40} /></span>
            <p className="text-sm text-gray-500">暂未获取到资讯内容</p>
            <p className="text-[11px] text-gray-400 mt-1">每日 08:00 自动更新，请联网后重试</p>
          </div>
        )}

        {!loading && !error && data && total === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <span className="text-gray-300 mb-3"><Icons.Newspaper size={40} /></span>
            <p className="text-sm text-gray-500">今日暂无可推送的资讯</p>
            <p className="text-[11px] text-gray-400 mt-1">数据源覆盖国内外官方监管与行业站点</p>
          </div>
        )}

        {!loading && !error && data && (
          SECTION_META.map((sec) => {
            const items = data.sections[sec.key] || []
            return (
              <section key={sec.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${sec.accent}`}>
                    {sec.icon}
                  </span>
                  <h2 className="text-sm font-semibold text-gray-900">{sec.label}</h2>
                  <span className="text-[11px] text-gray-400">{items.length}</span>
                </div>

                {items.length === 0 ? (
                  <p className="text-[11px] text-gray-300 px-1 mb-1">本板块今日暂无更新</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((it, i) => (
                      <a
                        key={i}
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-white rounded-2xl shadow-card p-3 active:scale-[0.99] transition-transform"
                      >
                        <div className="text-[13px] font-medium text-gray-900 leading-snug">{it.title}</div>
                        {it.summary && (
                          <div className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-3">
                            {it.summary}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {it.source && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              {it.source}
                            </span>
                          )}
                          {it.date && <span className="text-[10px] text-gray-400">{it.date}</span>}
                          <span className="text-[10px] text-primary ml-auto flex items-center gap-0.5">
                            来源 <Icons.ArrowUpRight size={11} />
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
