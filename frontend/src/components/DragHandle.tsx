import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface DragHandleProps {
  id: string
  type: 'category' | 'link'
  data: any
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export default function DragHandle({
  id,
  type,
  data,
  children,
  className = '',
  disabled = false
}: DragHandleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type,
      data,
    },
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${isDragging ? 'z-50 rotate-2 scale-105' : ''} transition-transform duration-200`}
      {...attributes}
    >
      <div className="group relative">
        {/* Drag handle icon */}
        {!disabled && (
          <div
            {...listeners}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-grab active:cursor-grabbing p-1 hover:bg-hover-bg rounded-md hover:scale-110"
            title={`Drag to reorder ${type}`}
          >
            <VerticalDragHandle className="w-4 h-4 text-text-secondary hover:text-primary" />
          </div>
        )}
        
        {/* Dragging overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg pointer-events-none" />
        )}
        
        {children}
      </div>
    </div>
  )
}

// Simple drag handle icon component for inline use
export function DragHandleIcon({ 
  className = '',
  ...props 
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={`w-4 h-4 text-text-secondary cursor-grab active:cursor-grabbing ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 8h16M4 16h16"
      />
    </svg>
  )
}

// Vertical dots drag handle
export function VerticalDragHandle({ 
  className = '',
  ...props 
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={`w-4 h-4 text-text-secondary cursor-grab active:cursor-grabbing ${className}`}
      fill="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}