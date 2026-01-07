/**
 * 格式化相对时间
 * @param dateString ISO 日期字符串
 * @returns 相对时间字符串，如 "刚刚", "3分钟前", "昨天", "2天前"
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return '尚未访问'
  }

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return '刚刚'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`
  }

  if (diffHours < 24) {
    return `${diffHours}小时前`
  }

  if (diffDays === 1) {
    return '昨天'
  }

  if (diffDays < 7) {
    return `${diffDays}天前`
  }

  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}周前`
  }

  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}个月前`
  }

  const years = Math.floor(diffDays / 365)
  return `${years}年前`
}

/**
 * 格式化访问次数
 * @param count 访问次数
 * @returns 格式化字符串，如 "访问 5 次" 或 "尚未访问"
 */
export function formatVisitCount(count: number | null | undefined): string {
  if (!count || count === 0) {
    return '尚未访问'
  }
  return `访问 ${count} 次`
}

/**
 * 格式化日期时间（用于列表显示）
 * @param dateString ISO 日期字符串
 * @returns 格式化的日期字符串
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 24) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffInHours < 24 * 7) {
    return date.toLocaleDateString('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

/**
 * 格式化日期时间（详细版本，用于笔记等）
 * @param dateString ISO 日期字符串
 * @returns 格式化的日期字符串
 */
export function formatDateTimeDetailed(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 24) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffInHours < 24 * 7) {
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
