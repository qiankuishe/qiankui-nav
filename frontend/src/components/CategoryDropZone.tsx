import { useDroppable } from '@dnd-kit/core'
import { useDragDrop } from '../contexts/DragDropContext'

interface CategoryDropZoneProps {
  categoryId: string
  categoryName: string
  children: React.ReactNode
  isEditMode: boolean
}

export default function CategoryDropZone({ categoryId, categoryName, children, isEditMode }: CategoryDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${categoryId}`,
    data: { type: 'category', data: { id: categoryId, name: categoryName } },
    disabled: !isEditMode,
  })

  const { isDragging, draggedItem } = useDragDrop()
  
  // 只有在拖拽链接且目标分类不是源分类时才显示高亮
  const showDropHighlight = isDragging && 
    draggedItem?.type === 'link' && 
    draggedItem?.data?.categoryId !== categoryId

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-xl transition-all duration-200 ${
        showDropHighlight 
          ? isOver 
            ? 'bg-primary/10 ring-2 ring-primary ring-offset-2' 
            : 'bg-primary/5 ring-2 ring-dashed ring-primary/30'
          : ''
      }`}
    >
      {children}
      {/* 拖放提示 */}
      {showDropHighlight && isOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            移动到 {categoryName}
          </div>
        </div>
      )}
    </div>
  )
}
