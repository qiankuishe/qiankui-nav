import { DocumentDuplicateIcon, PencilIcon, TrashIcon, CodeBracketIcon, PhotoIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { ClipboardItem } from '../utils/clipboardApi'

interface ClipboardItemCardProps {
  item: ClipboardItem
  onEdit: (item: ClipboardItem) => void
  onDelete: (item: ClipboardItem) => void
  onCopy: (item: ClipboardItem) => void
}

export default function ClipboardItemCard({ item, onEdit, onDelete, onCopy }: ClipboardItemCardProps) {
  const getTypeIcon = () => {
    switch (item.type) {
      case 'code': return <CodeBracketIcon className="w-4 h-4" />
      case 'image': return <PhotoIcon className="w-4 h-4" />
      default: return <DocumentTextIcon className="w-4 h-4" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-bg-card border border-border-main rounded-lg p-3 hover:shadow-sm transition-shadow group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 text-text-secondary">
          {getTypeIcon()}
          <span className="text-xs">{item.type === 'code' ? '代码' : item.type === 'image' ? '图片' : '文本'}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onCopy(item)} className="p-1 hover:bg-hover-bg rounded" title="复制">
            <DocumentDuplicateIcon className="w-4 h-4 text-text-secondary hover:text-primary" />
          </button>
          <button onClick={() => onEdit(item)} className="p-1 hover:bg-hover-bg rounded" title="编辑">
            <PencilIcon className="w-4 h-4 text-text-secondary hover:text-primary" />
          </button>
          <button onClick={() => onDelete(item)} className="p-1 hover:bg-hover-bg rounded" title="删除">
            <TrashIcon className="w-4 h-4 text-text-secondary hover:text-red-500" />
          </button>
        </div>
      </div>
      <h3 className="text-sm font-medium text-text-main truncate mb-1">{item.title}</h3>
      <p className="text-xs text-text-secondary line-clamp-2 mb-2">{item.content.substring(0, 100)}</p>
      <div className="text-xs text-text-secondary">{formatDate(item.createdAt)}</div>
    </div>
  )
}
