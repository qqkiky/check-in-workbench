import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// 组件内确认弹窗，替代原生 window.confirm() —— 在 PWA / iOS 独立模式下原生 confirm 会被静默拦截，导致删不掉任务
export function ConfirmDialog({
  open,
  title = '提示',
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-700 text-sm active:scale-95"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 h-10 rounded-xl text-white text-sm font-medium active:scale-95 ${
              danger ? 'bg-red-500' : 'bg-primary'
            }`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
    </Modal>
  )
}
