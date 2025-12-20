import { useState, useCallback } from 'react'
import { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { 
  updateLinkOrder, 
  moveLinkToCategory,
  type CategoryWithLinks 
} from '../utils/api'

interface UseDragOperationsProps {
  categories: CategoryWithLinks[]
  setCategories: (categories: CategoryWithLinks[]) => void
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function useDragOperations({
  categories,
  setCategories,
  onSuccess,
  onError
}: UseDragOperationsProps) {
  const [isDragInProgress, setIsDragInProgress] = useState(false)

  const handleDragStart = useCallback(() => {
    setIsDragInProgress(true)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setIsDragInProgress(false)
      return
    }

    const activeType = active.data.current?.type
    const overId = over.id.toString()

    try {
      // 链接拖拽
      if (activeType === 'link') {
        const activeLink = active.data.current?.data
        const sourceCategoryId = activeLink.categoryId

        // 检查是否拖到分类区域（跨分类移动）
        if (overId.startsWith('category-')) {
          const targetCategoryId = overId.replace('category-', '')
          
          if (sourceCategoryId !== targetCategoryId) {
            // 跨分类移动
            const updatedCategories = categories.map(cat => {
              if (cat.id === sourceCategoryId) {
                return { ...cat, links: cat.links.filter(l => l.id !== activeLink.id) }
              }
              if (cat.id === targetCategoryId) {
                const movedLink = { ...activeLink, categoryId: targetCategoryId, order: cat.links.length }
                return { ...cat, links: [...cat.links, movedLink] }
              }
              return cat
            })
            
            setCategories(updatedCategories)
            await moveLinkToCategory(activeLink.id, targetCategoryId)
            
            const targetCat = categories.find(c => c.id === targetCategoryId)
            onSuccess?.(`已移动到 "${targetCat?.name}"`)
          }
        } else {
          // 同分类内排序
          const overType = over.data.current?.type
          
          if (overType === 'link' && active.id !== over.id) {
            const overLink = over.data.current?.data
            
            // 同分类内排序
            if (sourceCategoryId === overLink.categoryId) {
              const category = categories.find(c => c.id === sourceCategoryId)
              if (category) {
                const oldIndex = category.links.findIndex(l => l.id === active.id)
                const newIndex = category.links.findIndex(l => l.id === over.id)
                
                if (oldIndex !== -1 && newIndex !== -1) {
                  const newLinks = arrayMove(category.links, oldIndex, newIndex)
                    .map((link, idx) => ({ ...link, order: idx }))
                  
                  const updatedCategories = categories.map(cat => 
                    cat.id === sourceCategoryId ? { ...cat, links: newLinks } : cat
                  )
                  
                  setCategories(updatedCategories)
                  await updateLinkOrder(sourceCategoryId, newLinks.map(l => l.id))
                  onSuccess?.('排序已更新')
                }
              }
            } else {
              // 拖到其他分类的链接上 = 移动到该分类
              const targetCategoryId = overLink.categoryId
              
              const updatedCategories = categories.map(cat => {
                if (cat.id === sourceCategoryId) {
                  return { ...cat, links: cat.links.filter(l => l.id !== activeLink.id) }
                }
                if (cat.id === targetCategoryId) {
                  const targetIndex = cat.links.findIndex(l => l.id === over.id)
                  const movedLink = { ...activeLink, categoryId: targetCategoryId }
                  const newLinks = [...cat.links]
                  newLinks.splice(targetIndex, 0, movedLink)
                  return { ...cat, links: newLinks.map((l, idx) => ({ ...l, order: idx })) }
                }
                return cat
              })
              
              setCategories(updatedCategories)
              await moveLinkToCategory(activeLink.id, targetCategoryId)
              
              const targetCat = categories.find(c => c.id === targetCategoryId)
              onSuccess?.(`已移动到 "${targetCat?.name}"`)
            }
          }
        }
      }
    } catch (error) {
      console.error('Drag operation error:', error)
      onError?.('操作失败，请重试')
    } finally {
      setIsDragInProgress(false)
    }
  }, [categories, setCategories, onSuccess, onError])

  const handleDragCancel = useCallback(() => {
    setIsDragInProgress(false)
  }, [])

  return {
    isDragInProgress,
    handleDragStart,
    handleDragEnd,
    handleDragCancel
  }
}
