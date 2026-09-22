// Capacitor 集成（可选）- 如果没有安装 @capacitor/core，自动降级到 web API
// 检测是否在 Capacitor 原生环境
export const isNative: boolean = (() => {
  try {
    // @ts-ignore
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
})()

export const platform: string = isNative ? 'native' : 'web'

// 触感反馈 - 兼容 Web 和原生
export async function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const ms = style === 'light' ? 8 : style === 'medium' ? 15 : 30
    try {
      navigator.vibrate(ms)
    } catch {
      // ignore
    }
  }
  // 如果安装了 Capacitor Haptics，可在此处启用更精细的原生触感
  // try {
  //   const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
  //   await Haptics.impact({ style: ... })
  // } catch {}
}