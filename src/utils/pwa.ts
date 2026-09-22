// PWA 安装引导
// ----------------------------------------------------------------------------
// 重要：不再调用 e.preventDefault()。
// 之前 preventDefault 会吞掉浏览器的「原生安装提示」（迷你信息栏 / 自动弹窗），
// 导致小米浏览器等依赖原生提示的环境「不再自动弹窗」。现在放任浏览器自行弹出，
// 用户能直接看到原生安装入口；本模块仅保留 appinstalled 状态清理，
// 以及供「更多 → 安装到手机」按钮在未触发原生提示时走手动引导的兜底。
type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: PromptEvent | null = null
const listeners = new Set<(v: boolean) => void>()

export function initPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 不 preventDefault：让浏览器原生安装提示自动弹出（满足小米等环境自动弹窗诉求）。
    // 仍记录事件，供「更多」页按钮在原生未弹时尝试一次 prompt()（浏览器已弹则调用无效，会被 catch）。
    deferredPrompt = e as PromptEvent
    listeners.forEach((l) => l(true))
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((l) => l(false))
  })
}

export function onInstallable(cb: (v: boolean) => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function isInstallable() {
  return deferredPrompt !== null
}

export async function installApp() {
  if (!deferredPrompt) return false
  try {
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null
    listeners.forEach((l) => l(false))
    return choice.outcome === 'accepted'
  } catch {
    // 浏览器已自行弹出原生提示，或环境不允许再次 prompt —— 回退到手动引导
    deferredPrompt = null
    listeners.forEach((l) => l(false))
    return false
  }
}

/** 探测是否 iOS Safari（包括 iOS PWA 内部 WebView 不会触发 beforeinstallprompt） */
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
}

/** 是否在 PWA 独立模式（已添加到主屏幕，从桌面图标启动） */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS 9+ 私有属性
    (navigator as any).standalone === true
  )
}

/** 浏览器判定（用于显示对应安装步骤） */
export function getInstallPlatform():
  | 'ios-safari'
  | 'android-chrome'
  | 'desktop-chrome'
  | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) return 'ios-safari'
  if (/Android/.test(ua) && /Chrome/.test(ua)) return 'android-chrome'
  if (/Chrome/.test(ua) && !/Edg|OPR/.test(ua)) return 'desktop-chrome'
  return 'other'
}

/** 是否在微信 / QQ / 微博 / 支付宝等内置 WebView 中。
 *  这些环境会屏蔽「添加到主屏幕」，必须引导用户用系统浏览器（Safari / Chrome）打开。 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /MicroMessenger|WeChat|QQ\/|Weibo|Alipay|UCBrowser|baiduboxapp/i.test(navigator.userAgent)
}

/** 是否小米 / 红米自带浏览器（MiuiBrowser）。
 *  该浏览器可安装 PWA，但常因「桌面快捷方式」权限未开导致点击无反应，需引导开启或用 Chrome。 */
export function isMiuiBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /MiuiBrowser|XiaoMi|Redmi/i.test(navigator.userAgent)
}
