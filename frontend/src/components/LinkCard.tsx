import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import FaviconImage from './FaviconImage'
import LinkTooltip from './LinkTooltip'
import { recordLinkVisit, type Link } from '../utils/api'

interface LinkCardProps {
  link: Link
  isEditMode: boolean
  onEdit: (link: Link) => void
  onDelete: (linkId: string) => void
  onVisitUpdate?: (linkId: string, visitCount: number, lastVisitedAt: string) => void
}

export default function LinkCard({ link, isEditMode, onEdit, onDelete, onVisitUpdate }: LinkCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: link.id,
    data: { type: 'link', data: link },
    disabled: !isEditMode,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    touchAction: isEditMode ? 'none' : 'auto',
  }

  const handleClick = async (e: React.MouseEvent) => {
    if (isEditMode) {
      e.preventDefault()
      return
    }
    
    // 打开链接
    window.open(link.url, '_blank', 'noopener,noreferrer')
    
    // 记录访问（异步，不阻塞）
    try {
      const result = await recordLinkVisit(link.id)
      onVisitUpdate?.(link.id, result.visitCount, result.lastVisitedAt)
    } catch (err) {
      console.error('Failed to record visit:', err)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(link)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(link.id)
  }

  const cardContent = (
    <div
      className={`group relative bg-bg-card border rounded-xl p-3 transition-all duration-200 ${
        isDragging 
          ? 'border-primary shadow-lg' 
          : isOver 
            ? 'border-primary/50 bg-primary/5' 
            : 'border-border-main'
      } ${
        isEditMode 
          ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/50' 
          : 'cursor-pointer hover:shadow-sm hover:border-primary/30'
      }`}
      onClick={handleClick}
    >
      {/* 编辑模式工具栏 */}
      {isEditMode && !isDragging && (
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={handleEdit} className="p-1.5 rounded-full bg-primary text-white shadow-sm hover:bg-primary-hover">
            <PencilIcon className="h-3 w-3" />
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600">
            <TrashIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 内容 */}
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-hover-bg flex items-center justify-center">
          <FaviconImage url={link.url} title={link.title} className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-main truncate group-hover:text-primary transition-colors">{link.title}</h3>
        </div>
      </div>
    </div>
  )

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      {...(isEditMode ? listeners : {})}
      className={`${isDragging ? 'opacity-40 z-50' : ''} ${isOver ? 'scale-95' : ''} ${isEditMode ? 'select-none' : ''} transition-all duration-200`}
    >
      {/* 非编辑模式下显示 Tooltip */}
      {!isEditMode ? (
        <LinkTooltip
          visitCount={link.visitCount || 0}
          lastVisitedAt={link.lastVisitedAt}
          description={link.description}
        >
          {cardContent}
        </LinkTooltip>
      ) : (
        cardContent
      )}
    </div>
  )
}
