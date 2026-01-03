import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * 防抖 hook - 延迟更新值
 * @param value 要防抖的值
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * 防抖回调 hook - 延迟执行回调函数
 * @param callback 要防抖的回调函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的回调函数和取消函数
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): [(...args: Parameters<T>) => void, () => void] {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const callbackRef = useRef(callback)

  // 保持回调函数最新
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      cancel()
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay, cancel]
  )

  // 清理
  useEffect(() => {
    return cancel
  }, [cancel])

  return [debouncedCallback, cancel]
}

/**
 * 防抖搜索 hook - 专门用于搜索场景
 * @param searchFn 搜索函数
 * @param delay 延迟时间（毫秒）
 * @returns { search, isSearching, cancel }
 */
export function useDebouncedSearch<T>(
  searchFn: (query: string) => T | Promise<T>,
  delay: number = 300
) {
  const [isSearching, setIsSearching] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsSearching(false)
  }, [])

  const search = useCallback(
    (query: string) => {
      cancel()
      
      if (!query.trim()) {
        return
      }

      setIsSearching(true)
      
      timeoutRef.current = setTimeout(async () => {
        try {
          await searchFn(query)
        } finally {
          setIsSearching(false)
        }
      }, delay)
    },
    [searchFn, delay, cancel]
  )

  useEffect(() => {
    return cancel
  }, [cancel])

  return { search, isSearching, cancel }
}
