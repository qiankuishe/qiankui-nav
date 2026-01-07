import { useState, useEffect, useRef, useCallback } from 'react'
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
import { Note, getNotes, createNote, updateNote, deleteNote } from '../utils/notesApi'
import ConfirmModal from './ConfirmModal'
import { useEventListener } from '../hooks/useEventListener'
import { formatDateTimeDetailed } from '../utils/formatters'
import { useNotification, SavingSpinner, Button, IconButton, Card, EmptyState, PageHeader, RADIUS } from './ui'

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked(content) as string)
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
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, noteId: '', noteTitle: '' })
  const [localHighlightId, setLocalHighlightId] = useState<string | null>(null)
  
  const processedHighlightRef = useRef<string | null>(null)
  const pendingContentRef = useRef<{ title: string; content: string } | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  
  const { showSuccess, showError, ToastContainer } = useNotification()

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getNotes()
      setNotes(data)
    } catch (err) {
      console.error('Error loading notes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotes()
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [loadNotes])

  useEventListener('dataImported', loadNotes)

  useEffect(() => {
    if (highlightId && notes.length > 0 && processedHighlightRef.current !== highlightId) {
      processedHighlightRef.current = highlightId
      setLocalHighlightId(highlightId)
      const note = notes.find(n => n.id === highlightId)
      if (note) handleSelectNote(note)
      setTimeout(() => setLocalHighlightId(null), 2000)
    }
    if (!highlightId) processedHighlightRef.current = null
  }, [highlightId, notes])

  const autoSave = useCallback(async (noteId: string, title: string, content: string) => {
    pendingContentRef.current = { title, content }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSaving(true)
    
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const latestContent = pendingContentRef.current
        if (!latestContent) return
        const updated = await updateNote(noteId, { 
          title: latestContent.title.trim() || '无标题', 
          content: latestContent.content 
        })
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
        setSelectedNote(prev => prev?.id === updated.id ? updated : prev)
        pendingContentRef.current = null
      } catch (err) {
        console.error('Error saving note:', err)
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [])

  const handleSelectNote = useCallback((note: Note, isNew = false) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
    setIsPreviewMode(!isNew)
    pendingContentRef.current = null
  }, [])

  const handleBack = useCallback(async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setIsPreviewMode(false)
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
  }, [selectedNote, editTitle, editContent])

  const handleCreateNote = useCallback(async () => {
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
  }, [handleSelectNote])

  const handleSaveAndPreview = useCallback(async () => {
    if (!selectedNote) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
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
      showSuccess('已保存')
    } catch (err) {
      console.error('Error saving note:', err)
      showError('保存失败')
    } finally {
      setSaving(false)
    }
  }, [selectedNote, editTitle, editContent, showSuccess, showError])

  const handleTitleChange = useCallback((value: string) => {
    setEditTitle(value)
    if (selectedNote) autoSave(selectedNote.id, value, editContent)
  }, [selectedNote, editContent, autoSave])

  const handleContentChange = useCallback((value: string) => {
    setEditContent(value)
    if (selectedNote) autoSave(selectedNote.id, editTitle, value)
  }, [selectedNote, editTitle, autoSave])

  const handleTogglePin = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!selectedNote) return
    try {
      const newPinned = selectedNote.is_pinned ? 0 : 1
      const updated = await updateNote(selectedNote.id, { is_pinned: newPinned })
      setSelectedNote(updated)
      setNotes(prev => [...prev.map(n => n.id === updated.id ? updated : n)].sort((a, b) => b.is_pinned - a.is_pinned))
      showSuccess(newPinned ? '已置顶' : '已取消置顶')
    } catch (err) {
      console.error('Error toggling pin:', err)
      showError('操作失败')
    }
  }, [selectedNote, showSuccess, showError])

  const handleDeleteNote = useCallback((noteId: string, noteTitle: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDeleteConfirm({ isOpen: true, noteId, noteTitle })
  }, [])

  const confirmDelete = useCallback(async () => {
    try {
      await deleteNote(deleteConfirm.noteId)
      if (selectedNote?.id === deleteConfirm.noteId) setSelectedNote(null)
      await loadNotes()
      showSuccess('已删除')
    } catch (err) {
      console.error('Error deleting note:', err)
      showError('删除失败')
    } finally {
      setDeleteConfirm({ isOpen: false, noteId: '', noteTitle: '' })
    }
  }, [deleteConfirm.noteId, selectedNote?.id, loadNotes, showSuccess, showError])

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
        title="删除笔记"
        message={`确定删除笔记「${deleteConfirm.noteTitle}」吗？`}
        confirmText="删除"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, noteId: '', noteTitle: '' })}
      />

      <PageHeader
        title="我的笔记"
        count={selectedNote ? undefined : notes.length}
        backButton={selectedNote ? (
          <button onClick={handleBack} className="flex items-center gap-2 hover:text-primary transition-colors">
            <ChevronLeftIcon className="w-5 h-5 flex-shrink-0" />
            <span>返回列表</span>
          </button>
        ) : undefined}
        action={
          !selectedNote ? (
            <Button onClick={handleCreateNote} disabled={saving} icon={<PlusIcon className="w-4 h-4" />}>
              新建
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              {saving && (
                <span className="text-xs text-text-secondary flex items-center gap-1.5">
                  <SavingSpinner />
                  <span className="hidden sm:inline">保存中...</span>
                </span>
              )}
              <IconButton 
                onClick={handleTogglePin}
                variant={selectedNote.is_pinned ? 'warning' : 'default'}
                title={selectedNote.is_pinned ? '取消置顶' : '置顶'}
              >
                <MapPinIcon className="w-4 h-4" />
              </IconButton>
              <IconButton 
                onClick={() => handleDeleteNote(selectedNote.id, selectedNote.title)}
                variant="danger"
                title="删除"
              >
                <TrashIcon className="w-4 h-4" />
              </IconButton>
            </div>
          )
        }
      />

      {selectedNote ? (
        <Card padding="none" className="overflow-hidden">
          <div className="px-3 sm:px-6 py-3 border-b border-border-main">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="标题"
                  className="w-full text-lg sm:text-xl font-semibold bg-transparent border-none outline-none text-primary placeholder-text-secondary"
                  style={{ textOverflow: 'ellipsis' }}
                  disabled={isPreviewMode}
                />
              </div>
              <Button
                onClick={isPreviewMode ? () => setIsPreviewMode(false) : handleSaveAndPreview}
                disabled={!isPreviewMode && saving}
                size="sm"
                icon={isPreviewMode ? <PencilSquareIcon className="w-4 h-4" /> : saving ? <SavingSpinner /> : <CheckIcon className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">{isPreviewMode ? '编辑' : saving ? '保存中...' : '保存'}</span>
              </Button>
            </div>
          </div>
          
          <div className="p-3 sm:p-6">
            {isPreviewMode ? (
              <div 
                className="prose prose-sm max-w-none min-h-[300px] sm:min-h-[400px] text-text-main break-words overflow-hidden
                  prose-headings:text-primary prose-headings:font-semibold
                  prose-p:text-text-main prose-p:leading-relaxed
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-text-main prose-strong:font-semibold
                  prose-code:text-primary prose-code:bg-hover-bg prose-code:px-1 prose-code:py-0.5 prose-code:rounded-lg prose-code:text-sm
                  prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:overflow-x-auto prose-pre:rounded-xl
                  prose-blockquote:border-l-primary prose-blockquote:text-text-secondary
                  prose-ul:text-text-main prose-ol:text-text-main prose-li:text-text-main
                  prose-hr:border-border-main"
                dangerouslySetInnerHTML={{ __html: editContent ? renderMarkdown(editContent) : '<p class="text-text-secondary">暂无内容</p>' }}
              />
            ) : (
              <textarea
                value={editContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="支持 Markdown 语法..."
                className={`block w-full min-h-[300px] sm:min-h-[400px] bg-transparent border-none outline-none resize-none text-text-main placeholder-text-secondary leading-relaxed font-mono text-sm`}
              />
            )}
          </div>
          <div className="px-3 sm:px-6 py-3 border-t border-border-main bg-hover-bg/30 flex items-center justify-between text-xs text-text-secondary">
            <span>{editContent.length} 字符 {isPreviewMode && '· 预览模式'}</span>
            <span className="flex items-center gap-1.5">
              {saving && <SavingSpinner />}
              <span className="hidden sm:inline">最后编辑：</span>{formatDateTimeDetailed(selectedNote.updated_at)}
            </span>
          </div>
        </Card>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<DocumentTextIcon className="w-16 h-16" />}
          title="暂无笔记"
          action={
            <Button onClick={handleCreateNote} disabled={saving} icon={<PlusIcon className="w-4 h-4" />}>
              创建第一篇笔记
            </Button>
          }
        />
      ) : (
        <Card padding="none" className="divide-y divide-border-main overflow-hidden">
          {notes.map(note => (
            <NoteListItem
              key={note.id}
              note={note}
              isHighlighted={localHighlightId === note.id}
              onSelect={handleSelectNote}
              onDelete={handleDeleteNote}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

interface NoteListItemProps {
  note: Note
  isHighlighted: boolean
  onSelect: (note: Note) => void
  onDelete: (noteId: string, noteTitle: string, e?: React.MouseEvent) => void
}

function NoteListItem({ note, isHighlighted, onSelect, onDelete }: NoteListItemProps) {
  return (
    <div
      data-search-id={note.id}
      onClick={() => onSelect(note)}
      className={`p-3 sm:p-4 cursor-pointer hover:bg-hover-bg transition-all group ${isHighlighted ? 'search-highlight' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {note.is_pinned === 1 && <MapPinIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
        <h3 
          className="font-medium text-primary"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 100px)' }}
        >
          {note.title || '无标题'}
        </h3>
      </div>
      <p className="text-sm text-text-secondary line-clamp-2 mb-2" style={{ wordBreak: 'break-word' }}>
        {note.content || '暂无内容'}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary/70">{formatDateTimeDetailed(note.updated_at)}</span>
        <IconButton
          onClick={(e) => onDelete(note.id, note.title, e)}
          variant="danger"
          className="opacity-0 group-hover:opacity-100"
        >
          <TrashIcon className="w-4 h-4" />
        </IconButton>
      </div>
    </div>
  )
}
