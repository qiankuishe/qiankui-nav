import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  ChevronLeftIcon,
  PencilSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { MapPinIcon } from '@heroicons/react/24/solid'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  Note,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
} from '../utils/notesApi'
import ConfirmModal from './ConfirmModal'
import { useEventListener } from '../hooks/useEventListener'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

// 安全渲染 Markdown
function renderMarkdown(content: string): string {
  const html = marked(content) as string
  return DOMPurify.sanitize(html)
}

interface NotesModuleProps {
  highlightId?: string | null
}

export default function NotesModule({ highlightId }: NotesModuleProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    noteId: string
    noteTitle: string
  }>({ isOpen: false, noteId: '', noteTitle: '' })
  const [localHighlightId, setLocalHighlightId] = useState<string | null>(null)
  const processedHighlightRef = useRef<string | null>(null)
  // 保存最新的编辑内容，用于防止保存丢失
  const pendingContentRef = useRef<{ title: string; content: string } | null>(null)

  const saveTimeoutRef = useRef<number | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const loadNotes = async () => {
    try {
      setLoading(true)
      const data = await getNotes()
      setNotes(data)
    } catch (err) {
      console.error('Error loading notes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // 监听数据导入事件
  useEventListener('dataImported', useCallback(() => loadNotes(), []))

  useEffect(() => {
    if (highlightId && notes.length > 0 && processedHighlightRef.current !== highlightId) {
      processedHighlightRef.current = highlightId
      setLocalHighlightId(highlightId)
      const note = notes.find((n) => n.id === highlightId)
      if (note) {
        handleSelectNote(note)
      }
      setTimeout(() => setLocalHighlightId(null), 2000)
    }
    if (!highlightId) {
      processedHighlightRef.current = null
    }
  }, [highlightId, notes])

  // 自动保存 - 使用 ref 确保保存最新内容
  const autoSave = async (noteId: string, title: string, content: string) => {
    // 更新待保存内容
    pendingContentRef.current = { title, content }
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    setSaving(true)
    
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        // 使用 ref 中的最新内容
        const latestContent = pendingContentRef.current
        if (!latestContent) return
        
        const updated = await updateNote(noteId, { 
          title: latestContent.title.trim() || '无标题', 
          content: latestContent.content 
        })
        // 保存成功后更新时间
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
        setSelectedNote(prev => prev?.id === updated.id ? updated : prev)
        pendingContentRef.current = null
      } catch (err) {
        console.error('Error saving note:', err)
      } finally {
        setSaving(false)
      }
    }, 800)
  }

  const handleSelectNote = (note: Note, isNew: boolean = false) => {
    // 立即保存当前笔记
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
    // 新建笔记进入编辑模式，已有笔记进入预览模式
    setIsPreviewMode(!isNew)
    pendingContentRef.current = null
  }

  const handleBack = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setIsPreviewMode(false)
    // 立即保存
    if (selectedNote && (editTitle !== selectedNote.title || editContent !== selectedNote.content)) {
      try {
        const updated = await updateNote(selectedNote.id, { 
          title: editTitle.trim() || '无标题', 
          content: editContent 
        })
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
      } catch (err) {
        console.error('Error saving note:', err)
      }
    }
    setSelectedNote(null)
    pendingContentRef.current = null
    setSaving(false)
  }

  const handleCreateNote = async () => {
    try {
      setSaving(true)
      const newNote = await createNote({ title: '新笔记', content: '' })
      setNotes(prev => [newNote, ...prev])
      handleSelectNote(newNote, true)
      setTimeout(() => titleInputRef.current?.select(), 100)
    } catch (err) {
      console.error('Error creating note:', err)
    } finally {
      setSaving(false)
    }
  }

  // 保存并切换到预览模式
  const handleSaveAndPreview = async () => {
    if (!selectedNote) return
    
    // 清除自动保存定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // 立即保存
    setSaving(true)
    try {
      const latestContent = pendingContentRef.current || { title: editTitle, content: editContent }
      const updated = await updateNote(selectedNote.id, { 
        title: latestContent.title.trim() || '无标题', 
        content: latestContent.content 
      })
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
      setSelectedNote(updated)
      pendingContentRef.current = null
      setIsPreviewMode(true)
      showNotification('success', '已保存')
    } catch (err) {
      console.error('Error saving note:', err)
      showNotification('error', '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTitleChange = (value: string) => {
    setEditTitle(value)
    if (selectedNote) {
      autoSave(selectedNote.id, value, editContent)
    }
  }

  const handleContentChange = (value: string) => {
    setEditContent(value)
    if (selectedNote) {
      autoSave(selectedNote.id, editTitle, value)
    }
  }

  const handleTogglePin = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!selectedNote) return
    
    try {
      const newPinned = selectedNote.is_pinned ? 0 : 1
      const updated = await updateNote(selectedNote.id, { is_pinned: newPinned })
      setSelectedNote(updated)
      // 重新排序列表
      let newNotes = notes.map(n => n.id === updated.id ? updated : n)
      newNotes = [...newNotes].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned
        return 0
      })
      setNotes(newNotes)
      showNotification('success', newPinned ? '已置顶' : '已取消置顶')
    } catch (err) {
      console.error('Error toggling pin:', err)
      showNotification('error', '操作失败')
    }
  }

  const handleDeleteNote = (noteId: string, noteTitle: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDeleteConfirm({ isOpen: true, noteId, noteTitle })
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 2000)
  }

  const confirmDelete = async () => {
    try {
      await deleteNote(deleteConfirm.noteId)
      if (selectedNote?.id === deleteConfirm.noteId) {
        setSelectedNote(null)
      }
      await loadNotes()
      showNotification('success', '已删除')
    } catch (err) {
      console.error('Error deleting note:', err)
      showNotification('error', '删除失败')
    } finally {
      setDeleteConfirm({ isOpen: false, noteId: '', noteTitle: '' })
    }
  }

  const formatDate = (dateString: string) => {
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

  // 保存中的加载动画
  const SavingSpinner = () => (
    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto overflow-hidden">
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.message}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="删除笔记"
        message={`确定删除笔记「${deleteConfirm.noteTitle}」吗？`}
        confirmText="删除"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, noteId: '', noteTitle: '' })}
      />

      {/* 标题栏 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-text-main">
          {selectedNote ? (
            <button 
              onClick={handleBack}
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
              <span>返回列表</span>
            </button>
          ) : (
            `我的笔记 (${notes.length})`
          )}
        </h2>
        {!selectedNote && (
          <button 
            onClick={handleCreateNote} 
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            新建
          </button>
        )}
        {selectedNote && (
          <div className="flex items-center gap-2 sm:gap-3">
            {saving && (
              <span className="text-xs text-text-secondary flex items-center gap-1.5">
                <SavingSpinner />
                保存中...
              </span>
            )}
            <button 
              onClick={handleTogglePin}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedNote.is_pinned 
                  ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' 
                  : 'text-text-secondary hover:bg-hover-bg'
              }`}
            >
              <MapPinIcon className="w-4 h-4" />
              {selectedNote.is_pinned ? '已置顶' : '置顶'}
            </button>
            <button 
              onClick={() => handleDeleteNote(selectedNote.id, selectedNote.title)}
              className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <TrashIcon className="w-4 h-4" />
              删除
            </button>
          </div>
        )}
      </div>

      {/* 笔记编辑器 */}
      {selectedNote ? (
        <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm">
          {/* 编辑器工具栏 */}
          <div className="px-6 py-3 border-b border-border-main flex items-center justify-between">
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="标题"
              className="flex-1 text-xl font-semibold bg-transparent border-none outline-none text-primary placeholder-text-secondary"
              disabled={isPreviewMode}
            />
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={isPreviewMode ? () => setIsPreviewMode(false) : handleSaveAndPreview}
                disabled={!isPreviewMode && saving}
                className="px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors bg-primary text-white disabled:opacity-50"
              >
                {isPreviewMode ? (
                  <>
                    <PencilSquareIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">编辑</span>
                  </>
                ) : saving ? (
                  <>
                    <SavingSpinner />
                    <span className="hidden sm:inline">保存中...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">保存</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {isPreviewMode ? (
              /* Markdown 预览 */
              <div 
                className="prose prose-sm max-w-none min-h-[400px] text-text-main
                  prose-headings:text-primary prose-headings:font-semibold
                  prose-p:text-text-main prose-p:leading-relaxed
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-text-main prose-strong:font-semibold
                  prose-code:text-primary prose-code:bg-hover-bg prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                  prose-pre:bg-gray-900 prose-pre:text-gray-100
                  prose-blockquote:border-l-primary prose-blockquote:text-text-secondary
                  prose-ul:text-text-main prose-ol:text-text-main
                  prose-li:text-text-main
                  prose-hr:border-border-main"
                dangerouslySetInnerHTML={{ 
                  __html: editContent ? renderMarkdown(editContent) : '<p class="text-text-secondary">暂无内容</p>' 
                }}
              />
            ) : (
              /* 编辑模式 */
              <textarea
                value={editContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="支持 Markdown 语法，如 **粗体**、*斜体*、# 标题、- 列表等..."
                className="w-full min-h-[400px] bg-transparent border-none outline-none resize-none text-text-main placeholder-text-secondary leading-relaxed font-mono text-sm"
              />
            )}
          </div>
          <div className="px-6 py-3 border-t border-border-main bg-hover-bg/30 flex items-center justify-between text-xs text-text-secondary">
            <span>{editContent.length} 字符 {isPreviewMode && '· 预览模式'}</span>
            <span className="flex items-center gap-1.5">
              {saving && <SavingSpinner />}
              最后编辑：{formatDate(selectedNote.updated_at)}
            </span>
          </div>
        </div>
      ) : (
        /* 笔记列表 */
        notes.length === 0 ? (
          <div className="bg-bg-card border border-border-main rounded-2xl p-12 text-center">
            <DocumentTextIcon className="w-16 h-16 mx-auto text-text-secondary/50 mb-4" />
            <p className="text-text-secondary mb-6">暂无笔记</p>
            <button 
              onClick={handleCreateNote}
              disabled={saving}
              className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              <PlusIcon className="w-4 h-4" />
              创建第一篇笔记
            </button>
          </div>
        ) : (
          <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm divide-y divide-border-main">
            {notes.map(note => (
              <div
                key={note.id}
                data-search-id={note.id}
                onClick={() => handleSelectNote(note)}
                className={`p-4 cursor-pointer hover:bg-hover-bg transition-all group ${
                  localHighlightId === note.id ? 'search-highlight' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-primary truncate mb-1 flex items-center gap-1.5">
                      {note.is_pinned === 1 && <MapPinIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      {note.title || '无标题'}
                    </h3>
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {note.content || '暂无内容'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-text-secondary/70 bg-hover-bg px-2 py-1 rounded-lg">
                      {formatDate(note.updated_at)}
                    </span>
                    <button
                      onClick={(e) => handleDeleteNote(note.id, note.title, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
