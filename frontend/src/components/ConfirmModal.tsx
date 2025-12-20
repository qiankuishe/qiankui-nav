import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  type = 'danger',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null

  const getButtonStyle = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white'
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white'
      default:
        return 'bg-primary hover:bg-primary-hover text-white'
    }
  }

  const getIconStyle = () => {
    switch (type) {
      case 'danger':
        return 'text-red-500 bg-red-50'
      case 'warning':
        return 'text-yellow-500 bg-yellow-50'
      default:
        return 'text-primary bg-primary/10'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-bg-card rounded-xl p-5 w-full max-w-sm border border-border-main shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${getIconStyle()}`}>
              <ExclamationTriangleIcon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-text-main">{title}</h3>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-hover-bg rounded-lg">
            <XMarkIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-4 pl-12">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 px-4 py-2 text-sm border border-border-main rounded-lg text-text-main hover:bg-hover-bg"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            className={`flex-1 px-4 py-2 text-sm rounded-lg ${getButtonStyle()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
