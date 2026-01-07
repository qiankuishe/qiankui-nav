/**
 * 通用类型定义
 */

// 通知类型
export type NotificationType = 'success' | 'error' | 'warning'

export interface Notification {
  type: NotificationType
  message: string
}

// 删除确认状态
export interface DeleteConfirmState {
  isOpen: boolean
  id: string
  title: string
}

// 笔记类型
export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  is_pinned: number
  created_at: string
  updated_at: string
}

// 剪贴板项目类型
export interface ClipboardItem {
  id: string
  type: 'text' | 'code' | 'image'
  title: string
  content: string
  is_public: number
  updated_at: string
}

// 链接类型
export interface Link {
  id: string
  userId: string
  categoryId: string
  title: string
  url: string
  description?: string
  iconUrl?: string
  order: number
  visitCount: number
  lastVisitedAt?: string | null
  createdAt: string
  updatedAt: string
}

// 分类类型
export interface Category {
  id: string
  userId: string
  name: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface CategoryWithLinks extends Category {
  links: Link[]
}

// 搜索结果类型
export interface SearchResult {
  type: 'link' | 'note' | 'clipboard'
  id: string
  title: string
  url?: string
  desc: string
}

// 弹窗状态类型
export type ModalType = 'addCategory' | 'editCategory' | 'addLink' | 'editLink' | null

export interface ModalState {
  type: ModalType
  data?: any
}
