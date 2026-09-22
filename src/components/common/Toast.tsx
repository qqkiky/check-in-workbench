import { useEffect, useState } from 'react'

/**
 * 轻提示：支持普通提示，以及带「动作按钮 + 倒计时」的可撤销提示。
 */
interface ToastState {
  id: number
  message: string
  actionText?: string
  onAction?: () => void
  duration: number
}

let toastSetter: ((t: ToastState | null) => void) | null = null

const DEFAULT_DURATION = 1800

export function showToast(msg: string, duration: number = DEFAULT_DURATION) {
  toastSetter?.({ id: Date.now(), message: msg, duration })
}

export function showActionToast(opts: {
  message: string
  actionText: string
  onAction: () => void
  duration?: number
}) {
  toastSetter?.({
    id: Date.now(),
    message: opts.message,
    actionText: opts.actionText,
    onAction: opts.onAction,
    duration: opts.duration ?? 8000,
  })
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    toastSetter = setToast
    return () => {
      toastSetter = null
    }
  }, [])

  if (!toast) return null
  return <ToastView toast={toast} onDismiss={() => setToast(null)} />
}

function ToastView({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, toast.duration)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center" key={toast.id}>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-black/80 backdrop-blur text-white text-sm rounded-full shadow-lg animate-in fade-in slide-in-from-top-2 max-w-[92%]">
        <span className="whitespace-nowrap">{toast.message}</span>
        {toast.actionText && (
          <button
            onClick={() => {
              toast.onAction?.()
              onDismiss()
            }}
            className="font-semibold text-blue-300 whitespace-nowrap active:opacity-70"
          >
            {toast.actionText}
          </button>
        )}
      </div>
      {toast.actionText && (
        <div className="mt-1 w-40 h-1 bg-black/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/70"
            style={{ animation: `toast-countdown ${toast.duration}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  )
}
