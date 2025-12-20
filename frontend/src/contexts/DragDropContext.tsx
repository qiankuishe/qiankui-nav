import { createContext, useContext, useState, ReactNode } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  DragOverlay,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { GlobeAltIcon } from '@heroicons/react/24/outline'

export interface DragItem {
  id: string
  type: 'category' | 'link'
  data: any
}

interface DragDropContextType {
  activeId: UniqueIdentifier | null
  isDragging: boolean
  draggedItem: DragItem | null
  overId: UniqueIdentifier | null
}

const DragDropContextValue = createContext<DragDropContextType>({
  activeId: null,
  isDragging: false,
  draggedItem: null,
  overId: null,
})

export const useDragDrop = () => {
  const context = useContext(DragDropContextValue)
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider')
  }
  return context
}

interface DragDropProviderProps {
  children: ReactNode
  onDragStart?: (event: DragStartEvent) => void
  onDragOver?: (event: DragOverEvent) => void
  onDragEnd?: (event: DragEndEvent) => void
  onDragCancel?: () => void
}

export function DragDropProvider({
  children,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: DragDropProviderProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id)
    
    const dragItem: DragItem = {
      id: active.id.toString(),
      type: active.data.current?.type || 'link',
      data: active.data.current?.data || {},
    }
    setDraggedItem(dragItem)
    
    onDragStart?.(event)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id || null)
    onDragOver?.(event)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    setDraggedItem(null)
    setOverId(null)
    onDragEnd?.(event)
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setDraggedItem(null)
    setOverId(null)
    onDragCancel?.()
  }

  const contextValue: DragDropContextType = {
    activeId,
    isDragging: activeId !== null,
    draggedItem,
    overId,
  }

  return (
    <DragDropContextValue.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeId && draggedItem ? <DragPreview item={draggedItem} /> : null}
        </DragOverlay>
      </DndContext>
    </DragDropContextValue.Provider>
  )
}

function DragPreview({ item }: { item: DragItem }) {
  if (item.type === 'link') {
    return (
      <div className="bg-bg-card border-2 border-primary rounded-lg p-3 shadow-2xl scale-105 w-[180px] cursor-grabbing">
        <div className="flex items-center gap-2.5">
          {item.data.iconUrl ? (
            <img src={item.data.iconUrl} alt="" className="w-8 h-8 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
              <GlobeAltIcon className="w-4 h-4 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-text-main truncate">{item.data.title}</h3>
          </div>
        </div>
      </div>
    )
  }
  return null
}

interface SortableProviderProps {
  children: ReactNode
  items: string[]
  strategy?: 'vertical' | 'horizontal' | 'grid'
}

export function SortableProvider({ children, items }: SortableProviderProps) {
  return (
    <SortableContext items={items} strategy={rectSortingStrategy}>
      {children}
    </SortableContext>
  )
}
