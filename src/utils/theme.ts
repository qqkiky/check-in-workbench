// 主题色工具：将用户选择的主题色（hex）转换为 rgb 三元组并写入 CSS 变量，
// 从而驱动 Tailwind 的 bg-primary / text-primary 等全站强调色。
// 同时派生浅色（light）与深色（dark）变体，供边框/高亮等场景使用。

export const DEFAULT_THEME = '#4F6EF7' // 默认：靛蓝

// 可选主题色预设（用户可在「更多 → 外观」中一键切换）
export const THEME_PRESETS: { name: string; value: string }[] = [
  { name: '靛蓝', value: '#4F6EF7' },
  { name: '经典蓝', value: '#3B82F6' },
  { name: '天青', value: '#0EA5E9' },
  { name: '翠绿', value: '#22C55E' },
  { name: '暖橙', value: '#F97316' },
  { name: '樱粉', value: '#EC4899' },
  { name: '紫罗兰', value: '#8B5CF6' },
]

type RGB = { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('')
  }
  const num = parseInt(h, 16)
  if (isNaN(num) || h.length !== 6) return { r: 79, g: 110, b: 247 } // 兜底默认色
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

function rgbToCss({ r, g, b }: RGB): string {
  return `${r} ${g} ${b}`
}

// 将颜色 c1 与 c2 按比例 weight(0~1, c2 占比) 混合
function mix(c1: RGB, c2: RGB, weight: number): RGB {
  const w = Math.max(0, Math.min(1, weight))
  return {
    r: Math.round(c1.r * (1 - w) + c2.r * w),
    g: Math.round(c1.g * (1 - w) + c2.g * w),
    b: Math.round(c1.b * (1 - w) + c2.b * w),
  }
}

const WHITE: RGB = { r: 255, g: 255, b: 255 }
const BLACK: RGB = { r: 0, g: 0, b: 0 }

/** 应用主题色：写入 --primary-rgb / --primary-rgb-light / --primary-rgb-dark */
export function applyThemeColor(hex?: string | null) {
  const base = hexToRgb(hex || DEFAULT_THEME)
  const light = mix(base, WHITE, 0.22)
  const dark = mix(base, BLACK, 0.18)
  const root = document.documentElement
  root.style.setProperty('--primary-rgb', rgbToCss(base))
  root.style.setProperty('--primary-rgb-light', rgbToCss(light))
  root.style.setProperty('--primary-rgb-dark', rgbToCss(dark))
}
