import { useState, useEffect, useRef } from 'react'
import {
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  PhotoIcon,
  DocumentDuplicateIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import ConfirmModal from './ConfirmModal'
import api from '../utils/api'

interface ClipboardItem {
  id: string
  type: 'text' | 'code' | 'image'
  title: string
  content: string
  updatedAt: string
}

interface ClipboardModuleProps {
  highlightId?: string | null
}

export default function ClipboardModule({ highlightId }: ClipboardModuleProps) {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; index: number }>({ isOpen: false, index: -1 })
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localHighlightId, setLocalHighlightId] = useState<string | null>(null)

  useEffect(() => {
    loadItems()
  }, [])

  // 处理外部传入的高亮ID
  useEffect(() => {
    if (highlightId && items.length > 0) {
      setLocalHighlightId(highlightId)
      // 滚动到目标元素
      setTimeout(() => {
        const el = document.querySelector(`[data-search-id="${highlightId}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      // 2秒后移除高亮
      setTimeout(() => setLocalHighlightId(null), 2000)
    }
  }, [highlightId, items])

  const loadItems = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/clipboard/items')
      setItems(response.data || [])
    } catch (err) {
      console.error('Error loading clipboard items:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveItems = async (newItems: ClipboardItem[]) => {
    // 防抖保存
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // 保存所有项目
        for (const item of newItems) {
          await api.put(`/api/clipboard/items/${item.id}`, {
            type: item.type,
            title: item.title,
            content: item.content,
          })
        }
      } catch (err) {
        console.error('Error saving clipboard items:', err)
      }
    }, 500)
  }

  const addItem = async (type: 'text' | 'code' | 'image') => {
    try {
      const response = await api.post('/api/clipboard/items', {
        type,
        title: '',
        content: '',
      })
      if (response.data?.data) {
        setItems([response.data.data, ...items])
      }
    } catch (err) {
      showNotification('error', '添加失败')
    }
  }

  const updateTitle = (index: number, title: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], title, updatedAt: new Date().toISOString() }
    setItems(newItems)
    saveItems(newItems)
  }

  const updateContent = (index: number, content: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], content, updatedAt: new Date().toISOString() }
    setItems(newItems)
    saveItems(newItems)
  }

  const copyItem = async (index: number) => {
    const item = items[index]
    try {
      if (item.type === 'image' && item.content) {
        // 图片复制
        const img = new Image()
        img.src = item.content
        await new Promise((resolve) => (img.onload = resolve))
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d')?.drawImage(img, 0, 0)
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        }
      } else {
        await navigator.clipboard.writeText(item.content || '')
      }
      showNotification('success', '已复制')
    } catch {
      showNotification('error', '复制失败')
    }
  }

  const deleteItem = async () => {
    if (deleteConfirm.index < 0) return
    try {
      const item = items[deleteConfirm.index]
      await api.delete(`/api/clipboard/items/${item.id}`)
      const newItems = items.filter((_, i) => i !== deleteConfirm.index)
      setItems(newItems)
      showNotification('success', '已删除')
    } catch {
      showNotification('error', '删除失败')
    } finally {
      setDeleteConfirm({ isOpen: false, index: -1 })
    }
  }

  const handleImageUpload = (index: number, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      showNotification('error', '图片不能超过5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      updateContent(index, content)
      showNotification('success', '图片上传成功')
    }
    reader.onerror = () => {
      showNotification('error', '上传失败')
    }
    reader.readAsDataURL(file)
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 2000)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'code':
        return <CodeBracketIcon className="w-3.5 h-3.5 text-indigo-500" />
      case 'image':
        return <PhotoIcon className="w-3.5 h-3.5 text-pink-500" />
      default:
        return <DocumentTextIcon className="w-3.5 h-3.5 text-primary" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'code':
        return 'border-indigo-200 dark:border-indigo-900'
      case 'image':
        return 'border-pink-200 dark:border-pink-900'
      default:
        return 'border-primary/20'
    }
  }

  const renderContent = (item: ClipboardItem, index: number) => {
    if (item.type === 'image') {
      return (
        <div>
          {item.content ? (
            <img
              src={item.content}
              alt=""
              className="max-w-full max-h-60 rounded-lg border border-border-main"
            />
          ) : (
            <div className="text-text-secondary text-sm py-4">点击下方按钮上传图片</div>
          )}
          <input
            type="file"
            id={`imgInput_${index}`}
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(index, file)
            }}
            className="hidden"
          />
          <button
            onClick={() => document.getElementById(`imgInput_${index}`)?.click()}
            className="mt-3 px-3 py-1.5 bg-pink-100 text-pink-700 rounded-lg text-sm font-medium hover:bg-pink-200 transition"
          >
            选择图片
          </button>
        </div>
      )
    } else if (item.type === 'code') {
      return (
        <textarea
          value={item.content}
          onChange={(e) => updateContent(index, e.target.value)}
          className="w-full h-36 bg-gray-900 text-green-400 rounded-lg p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          placeholder="粘贴代码..."
        />
      )
    } else {
      return (
        <textarea
          value={item.content}
          onChange={(e) => updateContent(index, e.target.value)}
          className="w-full h-28 bg-primary/5 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition text-text-main"
          placeholder="输入文本..."
        />
      )
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="删除剪切板项目"
        message="确定删除此项目？"
        confirmText="删除"
        type="danger"
        onConfirm={deleteItem}
        onCancel={() => setDeleteConfirm({ isOpen: false, index: -1 })}
      />

      {/* 通知 */}
      {notification && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* 头部 */}
      <div className="flex-shrink-0 px-5 py-4 bg-bg-card border-b border-border-main">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-text-main">剪切板</h2>
            <span className="text-sm text-text-secondary">共 {items.length} 项</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => addItem('text')}
              className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm flex items-center gap-1.5"
              title="添加文本"
            >
              <DocumentTextIcon className="w-4 h-4" />
              文本
            </button>
            <button
              onClick={() => addItem('code')}
              className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors text-sm flex items-center gap-1.5"
              title="添加代码"
            >
              <CodeBracketIcon className="w-4 h-4" />
              代码
            </button>
            <button
              onClick={() => addItem('image')}
              className="px-3 py-1.5 bg-pink-100 text-pink-600 rounded-lg hover:bg-pink-200 transition-colors text-sm flex items-center gap-1.5"
              title="添加图片"
            >
              <PhotoIcon className="w-4 h-4" />
              图片
            </button>
          </div>
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40">
            <ClipboardDocumentListIcon className="w-12 h-12 text-text-secondary mb-3" />
            <p className="text-text-secondary text-sm">暂无剪切板项目</p>
            <p className="text-text-secondary text-xs mt-1">点击上方按钮添加</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {items.map((item, index) => (
              <div
                key={item.id}
                data-search-id={item.id}
                className={`bg-bg-card rounded-xl border ${getTypeColor(item.type)} p-4 transition-all duration-300 ${localHighlightId === item.id ? 'search-highlight' : ''}`}
              >
                {/* 头部 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded flex-shrink-0 bg-hover-bg flex items-center justify-center">
                    {getTypeIcon(item.type)}
                  </span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateTitle(index, e.target.value)}
                    placeholder="标题"
                    className="font-medium bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-1 flex-1 min-w-0 text-text-main"
                  />
                  <button
                    onClick={() => copyItem(index)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition"
                    title="复制"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, index })}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="删除"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* 内容 */}
                {renderContent(item, index)}

                {/* 时间 */}
                <div className="text-xs text-text-secondary mt-2">
                  {new Date(item.updatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
