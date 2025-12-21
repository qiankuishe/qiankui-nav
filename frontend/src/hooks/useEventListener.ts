import { useEffect } from 'react'

/**
 * 自定义 hook 用于监听 window 事件
 * @param eventName 事件名称
 * @param handler 事件处理函数
 */
export function useEventListener(eventName: string, handler: () => void) {
  useEffect(() => {
    window.addEventListener(eventName, handler)
    return () => window.removeEventListener(eventName, handler)
  }, [eventName, handler])
}
