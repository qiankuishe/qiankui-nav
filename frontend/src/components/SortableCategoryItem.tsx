import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CategoryWithLinks } from '../utils/api'

interface SortableCategoryItemProps {
  category: CategoryWithLinks
  isSelected: boolean
  isEditMode: boolean
  onClick: () => void
}

export default function SortableCategoryItem({
  category,
  isSelected,
  isEditMode,
  onClick,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    data: { type: 'category', data: category },
    disabled: !isEditMode,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 150ms ease',
    touchAction: isEditMode ? 'none' : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isEditMode ? listeners : {})}
      onClick={() => !isEditMode && !isDragging && onClick()}
      className={`
        rounded-lg text-sm transition-all
        ${isDragging ? 'opacity-60 z-50 shadow-lg scale-105' : ''}
        ${isEditMode ? 'cursor-grab active:cursor-grabbing select-none' : 'cursor-pointer'}
        ${isSelected ? 'bg-primary text-white font-medium' : 'text-text-main hover:bg-hover-bg'}
      `}
    >
      <div className="w-full text-left px-3 py-2.5 truncate">
        {category.name} ({category.links.length})
      </div>
    </div>
  )
}
