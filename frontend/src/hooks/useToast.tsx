import { useState, useCallback } from 'react'

type ToastType = 'success' | 'error'

interface Toast {
  type: ToastType
  message: string
}

/**
 * 通用消息提示 hook
 * @param duration 消息显示时长（毫秒），默认 2000
 */
export function useToast(duration = 2000) {
  const [toast, setToast] = useState<Toast | null>(null)

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), duration)
  }, [duration])

  const showSuccess = useCallback((message: string) => showToast('success', message), [showToast])
  const showError = useCallback((message: string) => showToast('error', message), [showToast])

  const ToastContainer = () => toast ? (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${
      toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`}>
      {toast.message}
    </div>
  ) : null

  return { toast, showToast, showSuccess, showError, ToastContainer }
}
