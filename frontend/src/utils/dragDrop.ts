import { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import type { Category as APICategory, Link as APILink, CategoryWithLinks } from './api'

export type Category = APICategory
export type Link = APILink

/**
 * Handle category reordering within the same list
 */
export function handleCategoryReorder(
  categories: CategoryWithLinks[],
  event: DragEndEvent
): CategoryWithLinks[] {
  const { active, over } = event

  if (!over || active.id === over.id) {
    return categories
  }

  const oldIndex = categories.findIndex(cat => cat.id === active.id)
  const newIndex = categories.findIndex(cat => cat.id === over.id)

  if (oldIndex === -1 || newIndex === -1) {
    return categories
  }

  // Reorder the array
  const reorderedCategories = arrayMove(categories, oldIndex, newIndex)

  // Update order values
  return reorderedCategories.map((category, index) => ({
    ...category,
    order: index
  }))
}

/**
 * Handle link reordering within the same category
 */
export function handleLinkReorderInCategory(
  links: Link[],
  categoryId: string,
  event: DragEndEvent
): Link[] {
  const { active, over } = event

  if (!over || active.id === over.id) {
    return links
  }

  // Filter links for the specific category
  const categoryLinks = links.filter(link => link.categoryId === categoryId)
  const otherLinks = links.filter(link => link.categoryId !== categoryId)

  const oldIndex = categoryLinks.findIndex(link => link.id === active.id)
  const newIndex = categoryLinks.findIndex(link => link.id === over.id)

  if (oldIndex === -1 || newIndex === -1) {
    return links
  }

  // Reorder within category
  const reorderedCategoryLinks = arrayMove(categoryLinks, oldIndex, newIndex)

  // Update order values for category links
  const updatedCategoryLinks = reorderedCategoryLinks.map((link, index) => ({
    ...link,
    order: index
  }))

  // Combine with other links and sort by original order
  return [...otherLinks, ...updatedCategoryLinks].sort((a, b) => {
    if (a.categoryId === b.categoryId) {
      return a.order - b.order
    }
    return 0
  })
}

/**
 * Handle cross-category link movement
 */
export function handleCrossCategoryLinkMove(
  links: Link[],
  event: DragEndEvent,
  targetCategoryId: string
): Link[] {
  const { active } = event

  const linkToMove = links.find(link => link.id === active.id)
  if (!linkToMove || linkToMove.categoryId === targetCategoryId) {
    return links
  }

  // Get links in target category to determine new order
  const targetCategoryLinks = links.filter(link => 
    link.categoryId === targetCategoryId
  )
  const newOrder = targetCategoryLinks.length

  // Update the moved link
  const updatedLinks = links.map(link => {
    if (link.id === active.id) {
      return {
        ...link,
        categoryId: targetCategoryId,
        order: newOrder
      }
    }
    return link
  })

  // Reorder remaining links in source category
  const sourceCategoryId = linkToMove.categoryId
  const sourceCategoryLinks = updatedLinks
    .filter(link => link.categoryId === sourceCategoryId && link.id !== active.id)
    .sort((a, b) => a.order - b.order)

  // Update order values for source category
  const finalLinks = updatedLinks.map(link => {
    if (link.categoryId === sourceCategoryId && link.id !== active.id) {
      const newIndex = sourceCategoryLinks.findIndex(l => l.id === link.id)
      return { ...link, order: newIndex }
    }
    return link
  })

  return finalLinks
}

/**
 * Auto-scroll functionality for drag operations near boundaries
 */
export function setupAutoScroll(containerRef: React.RefObject<HTMLElement>) {
  let autoScrollInterval: ReturnType<typeof setInterval> | null = null
  const scrollSpeed = 5
  const scrollZone = 50 // pixels from edge to trigger scroll

  const startAutoScroll = (direction: 'up' | 'down') => {
    if (autoScrollInterval) return

    autoScrollInterval = setInterval(() => {
      const container = containerRef.current
      if (!container) return

      const scrollAmount = direction === 'up' ? -scrollSpeed : scrollSpeed
      container.scrollBy(0, scrollAmount)
    }, 16) // ~60fps
  }

  const stopAutoScroll = () => {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval)
      autoScrollInterval = null
    }
  }

  const handleMouseMove = (event: MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const y = event.clientY - rect.top

    if (y < scrollZone && container.scrollTop > 0) {
      startAutoScroll('up')
    } else if (y > rect.height - scrollZone && 
               container.scrollTop < container.scrollHeight - container.clientHeight) {
      startAutoScroll('down')
    } else {
      stopAutoScroll()
    }
  }

  return {
    startAutoScroll: () => {
      document.addEventListener('mousemove', handleMouseMove)
    },
    stopAutoScroll: () => {
      document.removeEventListener('mousemove', handleMouseMove)
      stopAutoScroll()
    }
  }
}

/**
 * Determine if a drag operation is valid
 */
export function isValidDrop(
  activeType: string,
  overType: string,
  activeData: any,
  overData: any
): boolean {
  // Category to category reordering
  if (activeType === 'category' && overType === 'category') {
    return true
  }

  // Link to link reordering within same category
  if (activeType === 'link' && overType === 'link') {
    return activeData.categoryId === overData.categoryId
  }

  // Link to category (cross-category move)
  if (activeType === 'link' && overType === 'category') {
    return activeData.categoryId !== overData.id
  }

  return false
}

/**
 * Get drop zone visual feedback class
 */
export function getDropZoneClass(
  isOver: boolean,
  canDrop: boolean,
  isDragging: boolean
): string {
  const baseClass = 'transition-colors duration-200'
  
  if (!isDragging) return baseClass
  
  if (isOver && canDrop) {
    return `${baseClass} bg-primary/10 border-primary border-2 border-dashed`
  }
  
  if (canDrop) {
    return `${baseClass} border-border-main border-2 border-dashed opacity-50`
  }
  
  return `${baseClass} opacity-30`
}