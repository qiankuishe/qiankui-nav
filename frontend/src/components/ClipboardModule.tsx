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
import { formatDateTime } from '../utils/formatters'
import { useNotification, Button, IconButton, Card, EmptyState, PageHeader, RADIUS } from './ui'

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

const TYPE_CONFIG = {
  code: { icon: CodeBracketIcon, label: '代码', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-200' },
  image: { icon: PhotoIcon, label: '图片', bgColor: 'bg-pink-50', textColor: 'text-pink-600', borderColor: 'border-pink-200' },
  text: { icon: DocumentTextIcon, label: '文本', bgColor: 'bg-amber-50', textColor: 'text-primary', borderColor: 'border-amber-200' },
} as const

export default function ClipboardModule({ highlightId }: ClipboardModuleProps) {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: '', title: '' })
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [localHighlightId, setLocalHighlightId] = useState<string | null>(null)
  
  const saveTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const { showSuccess, showError, ToastContainer } = useNotification()

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/clipboard/items')
      setItems(response.data?.data || [])
    } catch (err) {
      console.error('Error loading clipboard items:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])
  useEventListener('dataImported', loadItems)

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

  const saveItem = useCallback(async (item: ClipboardItem) => {
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
  }, [])

  const addItem = useCallback(async (type: 'text' | 'code' | 'image') => {
    setAddMenuOpen(false)
    try {
      const response = await api.post('/api/clipboard/items', { type, title: '', content: '' })
      if (response.data?.data) {
        setItems(prev => [response.data.data, ...prev])
        showSuccess('已添加')
      }
    } catch {
      showError('添加失败')
    }
  }, [showSuccess, showError])

  const updateItem = useCallback((id: string, updates: Partial<ClipboardItem>) => {
    if (updates.is_public === 1) {
      const publicCount = items.filter(i => i.is_public === 1 && i.id !== id).length
      if (publicCount >= 16) {
        showError('公开便签已达上限（最多16个）')
        return
      }
    }
    const newItems = items.map(item => 
      item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
    )
    setItems(newItems)
    const updated = newItems.find(i => i.id === id)
    if (updated) saveItem(updated)
  }, [items, saveItem, showError])

  const copyItem = useCallback(async (item: ClipboardItem, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      if (item.type === 'image' && item.content) {
        const img = new Image()
        img.src = item.content
        await new Promise(resolve => (img.onload = resolve))
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d')?.drawImage(img, 0, 0)
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
        if (blob) await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      } else {
        await navigator.clipboard.writeText(item.content || '')
      }
      showSuccess('已复制')
    } catch {
      showError('复制失败')
    }
  }, [showSuccess, showError])

  const deleteItem = useCallback(async () => {
    if (!deleteConfirm.id) return
    try {
      await api.delete(`/api/clipboard/items/${deleteConfirm.id}`)
      setItems(prev => prev.filter(i => i.id !== deleteConfirm.id))
      showSuccess('已删除')
    } catch {
      showError('删除失败')
    } finally {
      setDeleteConfirm({ isOpen: false, id: '', title: '' })
    }
  }, [deleteConfirm.id, showSuccess, showError])

  const handleImageUpload = useCallback((id: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      showError('图片不能超过5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      updateItem(id, { content: e.target?.result as string })
      showSuccess('图片已上传')
    }
    reader.onerror = () => showError('上传失败')
    reader.readAsDataURL(file)
  }, [updateItem, showSuccess, showError])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="w-full lg:max-w-3xl mx-auto sm:px-2" style={{ overflow: 'hidden' }}>
      <ToastContainer />
      
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="删除项目"
        message={`确定删除「${deleteConfirm.title || '此项目'}」吗？`}
        confirmText="删除"
        type="danger"
        onConfirm={deleteItem}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', title: '' })}
      />

      <PageHeader
        title="便签"
        count={items.length}
        action={
          <div className="relative">
            <Button onClick={() => setAddMenuOpen(!addMenuOpen)} icon={<PlusIcon className="w-4 h-4" />}>
              新建
            </Button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                <div className={`absolute right-0 mt-2 w-36 bg-bg-card border border-border-main ${RADIUS.md} shadow-lg z-50 overflow-hidden`}>
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
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<ClipboardDocumentListIcon className="w-16 h-16" />}
          title="暂无便签"
          action={
            <Button onClick={() => setAddMenuOpen(true)} icon={<PlusIcon className="w-4 h-4" />}>
              添加第一个便签
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <ClipboardCard
              key={item.id}
              item={item}
              isHighlighted={localHighlightId === item.id}
              onUpdate={updateItem}
              onCopy={copyItem}
              onDelete={(id, title) => setDeleteConfirm({ isOpen: true, id, title })}
              onImageUpload={handleImageUpload}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ClipboardCardProps {
  item: ClipboardItem
  isHighlighted: boolean
  onUpdate: (id: string, updates: Partial<ClipboardItem>) => void
  onCopy: (item: ClipboardItem, e?: React.MouseEvent) => void
  onDelete: (id: string, title: string) => void
  onImageUpload: (id: string, file: File) => void
}

function ClipboardCard({ item, isHighlighted, onUpdate, onCopy, onDelete, onImageUpload }: ClipboardCardProps) {
  const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG.text
  const TypeIcon = typeInfo.icon

  return (
    <div
      data-search-id={item.id}
      className={`bg-bg-card border ${RADIUS.lg} overflow-hidden ${
        isHighlighted ? 'search-highlight border-primary shadow-md' : 'border-border-main'
      }`}
    >
      <div className={`px-3 sm:px-4 py-3 border-b ${typeInfo.borderColor} ${typeInfo.bgColor}`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={`w-8 h-8 ${RADIUS.sm} flex items-center justify-center flex-shrink-0 bg-white/80 ${typeInfo.textColor}`}>
            <TypeIcon className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={item.title}
              onChange={(e) => onUpdate(item.id, { title: e.target.value })}
              placeholder={typeInfo.label}
              className={`w-full text-base font-medium bg-transparent border-none outline-none placeholder-text-secondary ${typeInfo.textColor}`}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <IconButton onClick={(e) => onCopy(item, e)} title="复制" className={typeInfo.textColor}>
              <DocumentDuplicateIcon className="w-4 h-4" />
            </IconButton>
            <IconButton
              onClick={() => onUpdate(item.id, { is_public: item.is_public ? 0 : 1 })}
              variant={item.is_public ? 'success' : 'default'}
              title={item.is_public ? '已公开' : '公开'}
            >
              <EyeIcon className="w-4 h-4" />
            </IconButton>
            <IconButton onClick={() => onDelete(item.id, item.title)} variant="danger" title="删除">
              <TrashIcon className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {item.type === 'image' ? (
          <ImageContent item={item} onImageUpload={onImageUpload} />
        ) : item.type === 'code' ? (
          <textarea
            value={item.content}
            onChange={(e) => onUpdate(item.id, { content: e.target.value })}
            className={`block w-full min-h-[120px] bg-gray-900 text-green-400 ${RADIUS.md} p-3 sm:p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
            placeholder="粘贴代码..."
          />
        ) : (
          <textarea
            value={item.content}
            onChange={(e) => onUpdate(item.id, { content: e.target.value })}
            className={`block w-full min-h-[100px] bg-hover-bg/50 ${RADIUS.md} p-3 sm:p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-text-main placeholder-text-secondary`}
            placeholder="输入文本..."
          />
        )}
      </div>

      <div className="px-3 sm:px-4 py-2 border-t border-border-main bg-hover-bg/30 flex items-center justify-between text-xs text-text-secondary">
        <span>{item.content?.length || 0} {item.type === 'image' ? 'bytes' : '字符'}</span>
        <span>{formatDateTime(item.updated_at)}</span>
      </div>
    </div>
  )
}

interface ImageContentProps {
  item: ClipboardItem
  onImageUpload: (id: string, file: File) => void
}

function ImageContent({ item, onImageUpload }: ImageContentProps) {
  const inputId = `imgInput_${item.id}`
  
  return (
    <div>
      {item.content ? (
        <img src={item.content} alt="" className={`max-w-full max-h-60 ${RADIUS.md} border border-border-main`} />
      ) : (
        <div className="text-text-secondary text-sm py-4">点击下方按钮上传图片</div>
      )}
      <input
        type="file"
        id={inputId}
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImageUpload(item.id, file)
        }}
        className="hidden"
      />
      <Button
        onClick={() => document.getElementById(inputId)?.click()}
        variant="secondary"
        size="sm"
        className="mt-3 bg-pink-100 text-pink-700 hover:bg-pink-200 border-none"
      >
        选择图片
      </Button>
    </div>
  )
}
