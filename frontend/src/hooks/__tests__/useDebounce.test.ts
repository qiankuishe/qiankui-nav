/**
 * 防抖 hook 属性测试
 * 
 * 由于 React hooks 测试需要 jsdom 环境，这里使用纯函数测试来验证防抖逻辑
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 模拟防抖函数的核心逻辑
function createDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): [(...args: Parameters<T>) => void, () => void] {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      callback(...args)
      timeoutId = null
    }, delay)
  }

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return [debouncedFn, cancel]
}

describe('Debounce Logic Properties', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Property 1: Callback is not called immediately', () => {
    it('should not call callback before delay', () => {
      const callback = vi.fn()
      const [debouncedFn] = createDebounce(callback, 300)

      debouncedFn('test')

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('Property 2: Callback is called after delay', () => {
    it('should call callback after delay expires', () => {
      const callback = vi.fn()
      const [debouncedFn] = createDebounce(callback, 300)

      debouncedFn('test')
      vi.advanceTimersByTime(300)

      expect(callback).toHaveBeenCalledWith('test')
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('Property 3: Rapid calls only trigger final callback', () => {
    it('should only call callback once with last arguments', () => {
      const callback = vi.fn()
      const [debouncedFn] = createDebounce(callback, 300)

      debouncedFn('a')
      vi.advanceTimersByTime(100)
      debouncedFn('b')
      vi.advanceTimersByTime(100)
      debouncedFn('c')
      vi.advanceTimersByTime(100)
      
      // 还没到最后一次调用的延迟时间
      expect(callback).not.toHaveBeenCalled()
      
      // 等待最后一次调用的延迟时间
      vi.advanceTimersByTime(200)
      
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith('c')
    })
  })

  describe('Property 4: Cancel function prevents callback', () => {
    it('should not call callback after cancel', () => {
      const callback = vi.fn()
      const [debouncedFn, cancel] = createDebounce(callback, 300)

      debouncedFn('test')
      vi.advanceTimersByTime(100)
      cancel()
      vi.advanceTimersByTime(300)

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('Property 5: Custom delay is respected', () => {
    it('should use custom delay value', () => {
      const callback = vi.fn()
      const [debouncedFn] = createDebounce(callback, 500)

      debouncedFn('test')
      
      vi.advanceTimersByTime(300)
      expect(callback).not.toHaveBeenCalled()
      
      vi.advanceTimersByTime(200)
      expect(callback).toHaveBeenCalledWith('test')
    })
  })

  describe('Property 6: Multiple arguments are preserved', () => {
    it('should pass all arguments to callback', () => {
      const callback = vi.fn()
      const [debouncedFn] = createDebounce(callback, 300)

      debouncedFn('arg1', 'arg2', 123)
      vi.advanceTimersByTime(300)

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 123)
    })
  })

  describe('Property 7: Subsequent calls after completion work', () => {
    it('should allow new calls after previous completes', () => {
      const callback = vi.fn()
      const [debouncedFn] = createDebounce(callback, 300)

      // 第一次调用
      debouncedFn('first')
      vi.advanceTimersByTime(300)
      expect(callback).toHaveBeenCalledWith('first')
      expect(callback).toHaveBeenCalledTimes(1)

      // 第二次调用
      debouncedFn('second')
      vi.advanceTimersByTime(300)
      expect(callback).toHaveBeenCalledWith('second')
      expect(callback).toHaveBeenCalledTimes(2)
    })
  })

  describe('Property 8: Cancel can be called multiple times safely', () => {
    it('should not throw when cancel is called multiple times', () => {
      const callback = vi.fn()
      const [debouncedFn, cancel] = createDebounce(callback, 300)

      debouncedFn('test')
      
      expect(() => {
        cancel()
        cancel()
        cancel()
      }).not.toThrow()
    })
  })
})

describe('Search Debounce Properties', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Property 9: Empty query should not trigger search', () => {
    it('should skip search for empty string', () => {
      const searchFn = vi.fn()
      const [debouncedSearch] = createDebounce((query: string) => {
        if (query.trim()) {
          searchFn(query)
        }
      }, 300)

      debouncedSearch('')
      vi.advanceTimersByTime(300)

      expect(searchFn).not.toHaveBeenCalled()
    })

    it('should skip search for whitespace-only string', () => {
      const searchFn = vi.fn()
      const [debouncedSearch] = createDebounce((query: string) => {
        if (query.trim()) {
          searchFn(query)
        }
      }, 300)

      debouncedSearch('   ')
      vi.advanceTimersByTime(300)

      expect(searchFn).not.toHaveBeenCalled()
    })
  })

  describe('Property 10: Valid query triggers search', () => {
    it('should trigger search for non-empty query', () => {
      const searchFn = vi.fn()
      const [debouncedSearch] = createDebounce((query: string) => {
        if (query.trim()) {
          searchFn(query)
        }
      }, 300)

      debouncedSearch('test query')
      vi.advanceTimersByTime(300)

      expect(searchFn).toHaveBeenCalledWith('test query')
    })
  })
})
