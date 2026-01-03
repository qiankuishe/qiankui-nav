import { useState, useRef, useEffect, useCallback } from 'react'
import { formatRelativeTime, formatVisitCount } from '../utils/formatters'

interface LinkTooltipProps {
  visitCount: number
  lastVisitedAt?: string | null
  description?: string
  children: React.ReactNode
}

export default function LinkTooltip({ 
  visitCount, 
  lastVisitedAt, 
  description, 
  children 
}: LinkTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const showTimeoutRef = useRef<NodeJS.Timeout>()
  const hideTimeoutRef = useRef<NodeJS.Timeout>()

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const padding = 8

    let top = triggerRect.bottom + padding
    let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2

    // 检查右边界
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding
    }

    // 检查左边界
    if (left < padding) {
      left = padding
    }

    // 检查下边界，如果超出则显示在上方
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = triggerRect.top - tooltipRect.height - padding
    }

    setPosition({ top, left })
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, 300) // 300ms 延迟显示
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
    }
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 100) // 100ms 延迟隐藏
  }, [])

  useEffect(() => {
    if (isVisible) {
      calculatePosition()
    }
  }, [isVisible, calculatePosition])

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  // 如果没有任何内容要显示，直接返回 children
  const hasContent = visitCount > 0 || lastVisitedAt || description
  if (!hasContent) {
    return <>{children}</>
  }

  const visitText = formatVisitCount(visitCount)
  const timeText = lastVisitedAt ? formatRelativeTime(lastVisitedAt) : null

  return (
    <div 
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative"
    >
      {children}
      
      {isVisible && (
        <div
          ref={tooltipRef}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[100] px-3 py-2 text-xs bg-gray-900 dark:bg-gray-700 text-white rounded-lg shadow-lg max-w-xs pointer-events-none animate-fade-in"
        >
          <div className="space-y-1">
            {/* 访问统计 */}
            <div className="flex items-center gap-2 text-gray-300">
              {visitCount > 0 ? (
                <>
                  <span className="text-primary-light font-medium">{visitText}</span>
                  {timeText && timeText !== '尚未访问' && (
                    <>
                      <span className="text-gray-500">·</span>
                      <span>{timeText}</span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-gray-400">{visitText}</span>
              )}
            </div>
            
            {/* 描述 */}
            {description && (
              <div className="text-gray-200 leading-relaxed">
                {description}
              </div>
            )}
          </div>
          
          {/* 箭头 */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
        </div>
      )}
    </div>
  )
}
