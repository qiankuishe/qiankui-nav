import { useState, useEffect, useRef } from 'react'
import {
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline'
import {
  Note,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
} from '../utils/notesApi'
import ConfirmModal from './ConfirmModal'

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
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    noteId: string
    noteTitle: string
  }>({ isOpen: false, noteId: '', noteTitle: '' })
  const [localHighlightId, setLocalHighlightId] = useState<string | null>(null)

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

  useEffect(() => {
    if (highlightId && notes.length > 0) {
      setLocalHighlightId(highlightId)
      const note = notes.find((n) => n.id === highlightId)
      if (note) {
        handleSelectNote(note)
      }
      setTimeout(() => setLocalHighlightId(null), 2000)
    }
  }, [highlightId, notes])

  // 自动保存
  const autoSave = async (noteId: string, title: string, content: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        setSaving(true)
        const updated = await updateNote(noteId, { title: title.trim() || '无标题', content })
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
        setSelectedNote(updated)
      } catch (err) {
        console.error('Error saving note:', err)
      } finally {
        setSaving(false)
      }
    }, 800)
  }

  const handleSelectNote = (note: Note) => {
    // 立即保存当前笔记
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
  }

  const handleBack = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      // 立即保存
      if (selectedNote && (editTitle !== selectedNote.title || editContent !== selectedNote.content)) {
        updateNote(selectedNote.id, { title: editTitle.trim() || '无标题', content: editContent })
          .then(updated => setNotes(prev => prev.map(n => n.id === updated.id ? updated : n)))
      }
    }
    setSelectedNote(null)
  }

  const handleCreateNote = async () => {
    try {
      setSaving(true)
      const newNote = await createNote({ title: '新笔记', content: '' })
      setNotes(prev => [newNote, ...prev])
      setSelectedNote(newNote)
      setEditTitle(newNote.title)
      setEditContent(newNote.content)
      setTimeout(() => titleInputRef.current?.select(), 100)
    } catch (err) {
      console.error('Error creating note:', err)
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

  const handleDeleteNote = (noteId: string, noteTitle: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDeleteConfirm({ isOpen: true, noteId, noteTitle })
  }

  const confirmDelete = async () => {
    try {
      await deleteNote(deleteConfirm.noteId)
      if (selectedNote?.id === deleteConfirm.noteId) {
        setSelectedNote(null)
      }
      await loadNotes()
    } catch (err) {
      console.error('Error deleting note:', err)
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
      return date.toLocaleDateString('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
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
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-text-secondary">保存中...</span>}
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
          <div className="p-6">
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="标题"
              className="w-full text-xl font-semibold bg-transparent border-none outline-none text-primary placeholder-text-secondary mb-4"
            />
            <textarea
              value={editContent}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="开始写点什么..."
              className="w-full min-h-[400px] bg-transparent border-none outline-none resize-none text-text-main placeholder-text-secondary leading-relaxed"
            />
          </div>
          <div className="px-6 py-3 border-t border-border-main bg-hover-bg/30 flex items-center justify-between text-xs text-text-secondary">
            <span>{editContent.length} 字符</span>
            <span>最后编辑：{formatDate(selectedNote.updated_at)}</span>
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
                    <h3 className="font-medium text-primary truncate mb-1">
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
