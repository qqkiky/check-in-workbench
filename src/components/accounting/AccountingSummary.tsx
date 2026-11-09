import { useLayoutEffect, useRef } from 'react'
import { formatMoney } from '@/utils/accounting'

interface Props {
  summary: { income: number; expense: number; balance: number }
  stats?: boolean
}

export function AccountingSummary({ summary: { income, expense, balance }, stats }: Props) {
  const card = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = card.current
    if (!element) return
    const amounts = Array.from(element.querySelectorAll<HTMLElement>('.account-summary-amount'))
    const fit = () => {
      element.style.removeProperty('--account-amount-size')
      const baseSize = parseFloat(getComputedStyle(amounts[0]).fontSize)
      let scale = 1
      for (const amount of amounts) {
        const available = amount.parentElement!.getBoundingClientRect().width
        const required = amount.getBoundingClientRect().width
        if (available > 0 && required > available) scale = Math.min(scale, (available - 0.5) / required)
      }
      if (scale < 1) {
        element.style.setProperty('--account-amount-size', `${Math.floor(baseSize * scale * 10) / 10}px`)
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [income, expense, balance])

  return (
    <div ref={card} className={`account-summary bg-white rounded-2xl p-3 shadow-card grid grid-cols-3 gap-2 ${stats ? 'account-summary-stats' : ''}`}>
      {[
        { label: '收入', amount: income, color: 'text-green-600' },
        { label: '支出', amount: expense, color: 'text-red-500' },
        { label: '结余', amount: balance, color: 'text-gray-900' },
      ].map(({ label, amount, color }, i) => (
        <div key={label} className={`min-w-0 text-center ${i === 1 ? 'border-x border-gray-100' : ''}`}>
          <div className="account-summary-value">
            <span className={`account-summary-amount font-bold ${color}`}>{formatMoney(amount)}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}
