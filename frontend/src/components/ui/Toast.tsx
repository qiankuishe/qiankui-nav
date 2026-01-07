import { useState, useCallback } from 'react'
import type { NotificationType, Notification } from '../../types'

/**
 * Toast 通知组件
 */
export function Toast({ notification }: { notification: Notification }) {
  const bgColor = notification.type === 'success' 
    ? 'bg-green-500' 
    : notification.type === 'error' 
      ? 'bg-red-500' 
      : 'bg-yellow-500'
  
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${bgColor}`}>
      {notification.message}
    </div>
  )
}

/**
 * 统一的 Toast Hook
 * 合并了 useToast 和 useDragFeedback 的功能
 */
export function useNotification(duration = 2000) {
  const [notification, setNotification] = useState<Notification | null>(null)

  const show = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), duration)
  }, [duration])

  const showSuccess = useCallback((message: string) => show('success', message), [show])
  const showError = useCallback((message: string) => show('error', message), [show])
  const showWarning = useCallback((message: string) => show('warning', message), [show])

  const ToastContainer = () => notification ? <Toast notification={notification} /> : null

  return { notification, show, showSuccess, showError, showWarning, ToastContainer }
}
