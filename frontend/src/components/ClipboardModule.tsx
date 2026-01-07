import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  PhotoIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PlusIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import ConfirmModal from './ConfirmModal'
import api from '../utils/api'
import { useEventListener } from '../hooks/useEventListener'

interface ClipboardItem {
  id: string
  type: 'text' | 'code' | 'image'
  title: string
  content: string
  is_public: number
  updated_at: string
}

interface ClipboardModuleProps {
  highlightId?: string | null
}

export default function ClipboardModule({ highlightId }: ClipboardModuleProps) {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; title: string }>({ isOpen: false, id: '', title: '' })
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const saveTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [localHighlightId, setLocalHighlightId] = useState<string | null>(null)

  useEffect(() => { loadItems() }, [])

  useEventListener('dataImported', useCallback(() => loadItems(), []))

  useEffect(() => {
    if (highlightId && items.length > 0) {
      setLocalHighlightId(highlightId)
      setTimeout(() => {
        const el = document.querySelector(`[data-search-id="${highlightId}"]`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      setTimeout(() => setLocalHighlightId(null), 2000)
    }
  }, [highlightId, items])

  const loadItems = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/clipboard/items')
      setItems(response.data?.data || [])
    } catch (err) {
      console.error('Error loading clipboard items:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveItem = async (item: ClipboardItem) => {
    const existingTimeout = saveTimeoutsRef.current.get(item.id)
    if (existingTimeout) clearTimeout(existingTimeout)
    
    const timeout = setTimeout(async () => {
      try {
        await api.put(`/api/clipboard/items/${item.id}`, {
          type: item.type, title: item.title, content: item.content, is_public: item.is_public,
        })
      } catch (err) {
        console.error('Error saving item:', err)
      }
      saveTimeoutsRef.current.delete(item.id)
    }, 800)
    
    saveTimeoutsRef.current.set(item.id, timeout)
  }

  const addItem = async (type: 'text' | 'code' | 'image') => {
    setAddMenuOpen(false)
    try {
      const response = await api.post('/api/clipboard/items', { type, title: '', content: '' })
      if (response.data?.data) {
        setItems([response.data.data, ...items])
        showNotification('success', '已添加')
      }
    } catch {
      showNotification('error', '添加失败')
    }
  }

  const updateItem = (id: string, updates: Partial<ClipboardItem>) => {
    if (updates.is_public === 1) {
      const publicCount = items.filter(i => i.is_public === 1 && i.id !== id).length
      if (publicCount >= 16) {
        showNotification('error', '公开便签已达上限（最多16个）')
        return
      }
    }
    const newItems = items.map(item => 
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    )
    setItems(newItems)
    const updated = newItems.find(i => i.id === id)
    if (updated) saveItem(updated)
  }

  const copyItem = async (item: ClipboardItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      if (item.type === 'image' && item.content) {
        const img = new Image()
        img.src = item.content
        await new Promise((resolve) => (img.onload = resolve))
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d')?.drawImage(img, 0, 0)
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
        if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      } else {
        await navigator.clipboard.writeText(item.content || '')
      }
      showNotification('success', '已复制')
    } catch {
      showNotification('error', '复制失败')
    }
  }

  const deleteItem = async () => {
    if (!deleteConfirm.id) return
    try {
      await api.delete(`/api/clipboard/items/${deleteConfirm.id}`)
      setItems(items.filter(i => i.id !== deleteConfirm.id))
      showNotification('success', '已删除')
    } catch {
      showNotification('error', '删除失败')
    } finally {
      setDeleteConfirm({ isOpen: false, id: '', title: '' })
    }
  }

  const handleImageUpload = (id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      showNotification('error', '图片不能超过5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      updateItem(id, { content: e.target?.result as string })
      showNotification('success', '图片已上传')
    }
    reader.onerror = () => showNotification('error', '上传失败')
    reader.readAsDataURL(file)
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 2000)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    if (diffInHours < 24) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (diffInHours < 24 * 7) return date.toLocaleDateString('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'code': return { icon: CodeBracketIcon, label: '代码', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-200' }
      case 'image': return { icon: PhotoIcon, label: '图片', bgColor: 'bg-pink-50', textColor: 'text-pink-600', borderColor: 'border-pink-200' }
      default: return { icon: DocumentTextIcon, label: '文本', bgColor: 'bg-amber-50', textColor: 'text-primary', borderColor: 'border-amber-200' }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-0">
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="删除项目"
        message={`确定删除「${deleteConfirm.title || '此项目'}」吗？`}
        confirmText="删除"
        type="danger"
        onConfirm={deleteItem}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', title: '' })}
      />

      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.message}
        </div>
      )}

      {/* 标题栏 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-text-main">便签 ({items.length})</h2>
        <div className="relative">
          <button 
            onClick={() => setAddMenuOpen(!addMenuOpen)}
            className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all text-sm font-medium flex items-center gap-2 shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            新建
          </button>
          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-36 bg-bg-card border border-border-main rounded-xl shadow-lg z-50 overflow-hidden">
                <button onClick={() => addItem('text')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-hover-bg flex items-center gap-2 text-text-main">
                  <DocumentTextIcon className="w-4 h-4 text-primary" />文本
                </button>
                <button onClick={() => addItem('code')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-hover-bg flex items-center gap-2 text-text-main">
                  <CodeBracketIcon className="w-4 h-4 text-indigo-500" />代码
                </button>
                <button onClick={() => addItem('image')} className="w-full px-4 py-2.5 text-left text-sm hover:bg-hover-bg flex items-center gap-2 text-text-main">
                  <PhotoIcon className="w-4 h-4 text-pink-500" />图片
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 内容列表 */}
      {items.length === 0 ? (
        <div className="bg-bg-card border border-border-main rounded-2xl p-12 text-center">
          <ClipboardDocumentListIcon className="w-16 h-16 mx-auto text-text-secondary/50 mb-4" />
          <p className="text-text-secondary mb-6">暂无便签</p>
          <button 
            onClick={() => setAddMenuOpen(true)}
            className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all text-sm font-medium inline-flex items-center gap-2 shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            添加第一个便签
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const typeInfo = getTypeInfo(item.type)
            const TypeIcon = typeInfo.icon
            
            return (
              <div
                key={item.id}
                data-search-id={item.id}
                className={`bg-bg-card border rounded-xl ${
                  localHighlightId === item.id ? 'search-highlight border-primary shadow-md' : 'border-border-main'
                }`}
              >
                {/* 头部 */}
                <div className={`px-3 sm:px-4 py-3 border-b ${typeInfo.borderColor} ${typeInfo.bgColor}`}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/80 ${typeInfo.textColor}`}>
                      <TypeIcon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateItem(item.id, { title: e.target.value })}
                        placeholder={typeInfo.label}
                        className={`w-full text-base font-medium bg-transparent border-none outline-none placeholder-text-secondary ${typeInfo.textColor}`}
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => copyItem(item, e)}
                        className={`p-1.5 rounded-lg transition ${typeInfo.textColor} hover:bg-white/50`}
                        title="复制"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateItem(item.id, { is_public: item.is_public ? 0 : 1 })}
                        className={`p-1.5 rounded-lg transition ${item.is_public ? 'text-green-600 bg-green-100' : 'text-text-secondary hover:bg-white/50'}`}
                        title={item.is_public ? '已公开' : '公开'}
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, id: item.id, title: item.title })}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="删除"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 内容区 */}
                <div className="p-3 sm:p-4">
                  {item.type === 'image' ? (
                    <div>
                      {item.content ? (
                        <img src={item.content} alt="" className="max-w-full max-h-60 rounded-xl border border-border-main" />
                      ) : (
                        <div className="text-text-secondary text-sm py-4">点击下方按钮上传图片</div>
                      )}
                      <input
                        type="file"
                        id={`imgInput_${item.id}`}
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(item.id, file)
                        }}
                        className="hidden"
                      />
                      <button
                        onClick={() => document.getElementById(`imgInput_${item.id}`)?.click()}
                        className="mt-3 px-4 py-2 bg-pink-100 text-pink-700 rounded-xl text-sm font-medium hover:bg-pink-200 transition"
                      >
                        选择图片
                      </button>
                    </div>
                  ) : item.type === 'code' ? (
                    <textarea
                      value={item.content}
                      onChange={(e) => updateItem(item.id, { content: e.target.value })}
                      className="block w-full min-h-[120px] bg-gray-900 text-green-400 rounded-xl p-3 sm:p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="粘贴代码..."
                    />
                  ) : (
                    <textarea
                      value={item.content}
                      onChange={(e) => updateItem(item.id, { content: e.target.value })}
                      className="block w-full min-h-[100px] bg-hover-bg/50 rounded-xl p-3 sm:p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-main placeholder-text-secondary"
                      placeholder="输入文本..."
                    />
                  )}
                </div>

                {/* 底部信息 */}
                <div className="px-3 sm:px-4 py-2 border-t border-border-main bg-hover-bg/30 flex items-center justify-between text-xs text-text-secondary">
                  <span>{item.content?.length || 0} {item.type === 'image' ? 'bytes' : '字符'}</span>
                  <span>{formatDate(item.updated_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
