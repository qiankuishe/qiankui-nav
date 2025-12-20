import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { getDropZoneClass } from '../utils/dragDrop'
import { useDragDrop } from '../contexts/DragDropContext'

interface DropZoneProps {
  id: string
  type: 'category' | 'link-container'
  data?: any
  children: React.ReactNode
  className?: string
  acceptTypes?: string[]
  onDrop?: (draggedItem: any, dropZoneData: any) => void
}

export default function DropZone({
  id,
  type,
  data,
  children,
  className = '',
  acceptTypes = ['category', 'link'],
  onDrop
}: DropZoneProps) {
  const { isDragging, draggedItem } = useDragDrop()
  
  const {
    isOver,
    setNodeRef,
  } = useDroppable({
    id,
    data: {
      type,
      data,
    },
  })

  // Determine if this drop zone can accept the current drag item
  const canDrop = draggedItem ? acceptTypes.includes(draggedItem.type) : false

  // Handle drop logic
  React.useEffect(() => {
    if (isOver && canDrop && draggedItem && onDrop) {
      onDrop(draggedItem, data)
    }
  }, [isOver, canDrop, draggedItem, data, onDrop])

  const dropZoneClass = getDropZoneClass(isOver, canDrop, isDragging)

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${dropZoneClass}`}
    >
      {children}
      
      {/* Drop indicator overlay */}
      {isDragging && canDrop && (
        <div className="absolute inset-0 pointer-events-none">
          {isOver && (
            <div className="absolute inset-0 bg-primary/5 border-2 border-primary border-dashed rounded-lg flex items-center justify-center">
              <div className="bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                Drop here
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Category drop zone specifically for cross-category link moves
export function CategoryDropZone({
  categoryId,
  categoryName,
  children,
  className = ''
}: {
  categoryId: string
  categoryName: string
  children: React.ReactNode
  className?: string
  onLinkDrop?: (linkId: string, targetCategoryId: string) => void
}) {
  const { isDragging, draggedItem } = useDragDrop()
  
  const {
    isOver,
    setNodeRef,
  } = useDroppable({
    id: `category-${categoryId}`,
    data: {
      type: 'category',
      data: { id: categoryId, name: categoryName },
    },
  })

  // Only accept links from different categories
  const canDrop = draggedItem?.type === 'link' && 
                  draggedItem.data.categoryId !== categoryId

  const dropZoneClass = getDropZoneClass(isOver, canDrop, isDragging)

  return (
    <div
      ref={setNodeRef}
      className={`relative ${className} ${dropZoneClass}`}
    >
      {children}
      
      {/* Cross-category drop indicator */}
      {isDragging && canDrop && isOver && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-primary text-white px-3 py-1 rounded-full text-sm font-medium">
            Move to "{categoryName}"
          </div>
        </div>
      )}
    </div>
  )
}

// Empty state drop zone for when categories have no links
export function EmptyDropZone({
  categoryId,
  categoryName
}: {
  categoryId: string
  categoryName: string
  onLinkDrop?: (linkId: string, targetCategoryId: string) => void
}) {
  const { isDragging, draggedItem } = useDragDrop()
  
  const {
    isOver,
    setNodeRef,
  } = useDroppable({
    id: `empty-${categoryId}`,
    data: {
      type: 'category',
      data: { id: categoryId, name: categoryName },
    },
  })

  const canDrop = draggedItem?.type === 'link' && 
                  draggedItem.data.categoryId !== categoryId

  if (!isDragging || !canDrop) {
    return null
  }

  return (
    <div
      ref={setNodeRef}
      className={`h-16 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
        isOver 
          ? 'border-primary bg-primary/10' 
          : 'border-border-main bg-hover-bg/50'
      }`}
    >
      <span className="text-text-secondary text-sm">
        {isOver ? `Drop in "${categoryName}"` : 'Drop links here'}
      </span>
    </div>
  )
}