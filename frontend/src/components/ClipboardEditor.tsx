import { useState } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { ClipboardItem, createClipboardItem, updateClipboardItem } from '../utils/clipboardApi'

interface ClipboardEditorProps {
  item: ClipboardItem | null
  onSave: () => void
  onCancel: () => void
}

export default function ClipboardEditor({ item, onSave, onCancel }: ClipboardEditorProps) {
  const [title, setTitle] = useState(item?.title || '')
  const [content, setContent] = useState(item?.content || '')
  const [type, setType] = useState<'text' | 'code' | 'image'>(item?.type || 'text')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    try {
      setSaving(true)
      if (item) {
        await updateClipboardItem(item.id, { title: title.trim(), content: content.trim() })
      } else {
        await createClipboardItem({ title: title.trim(), content: content.trim(), type })
      }
      onSave()
    } catch (err) {
      console.error('Error saving clipboard item:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg-main">
      <div className="flex-shrink-0 px-5 py-4 bg-bg-card border-b border-border-main flex items-center gap-3">
        <button onClick={onCancel} className="p-1.5 hover:bg-hover-bg rounded-lg">
          <ArrowLeftIcon className="w-5 h-5 text-text-secondary" />
        </button>
        <h2 className="text-lg font-medium text-text-main">{item ? '编辑' : '新建'}剪切板项目</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-5 max-w-2xl">
        <div className="mb-4">
          <label className="block text-sm text-text-main mb-1.5">标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入标题..."
            className="w-full px-3 py-2 text-sm border border-border-main rounded-lg bg-bg-card text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm text-text-main mb-1.5">类型</label>
          <div className="flex gap-2">
            {(['text', 'code', 'image'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 text-sm rounded-lg ${type === t ? 'bg-primary text-white' : 'bg-bg-card text-text-secondary border border-border-main hover:bg-hover-bg'}`}
              >
                {t === 'text' ? '文本' : t === 'code' ? '代码' : '图片'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 mb-4">
          <label className="block text-sm text-text-main mb-1.5">内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入内容..."
            className="w-full h-full min-h-[200px] px-3 py-2 text-sm border border-border-main rounded-lg bg-bg-card text-text-main resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            required
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-border-main rounded-lg text-text-main hover:bg-hover-bg">
            取消
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
