import { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import { SortableProvider } from '../contexts/DragDropContext'
import DragHandle from './DragHandle'
import { CategoryDropZone } from './DropZone'
import type { CategoryWithLinks } from '../utils/api'
import { getUserSettings } from '../utils/settingsApi'

interface SidebarProps {
  categories: CategoryWithLinks[]
  selectedCategoryId: string | null
  onCategorySelect: (categoryId: string | null) => void
  onCreateCategory: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  isEditMode?: boolean
  onLinkDrop?: (linkId: string, targetCategoryId: string) => void
}

export default function Sidebar({
  categories,
  selectedCategoryId,
  onCategorySelect,
  onCreateCategory,
  isCollapsed,
  onToggleCollapse,
  isEditMode = false,
  onLinkDrop
}: SidebarProps) {
  const totalLinks = categories.reduce((sum, cat) => sum + cat.links.length, 0)
  const [siteName, setSiteName] = useState('导航')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    loadSiteSettings()
    
    // 监听设置更新事件
    const handleSettingsUpdate = () => loadSiteSettings()
    window.addEventListener('siteSettingsUpdated', handleSettingsUpdate)
    return () => window.removeEventListener('siteSettingsUpdated', handleSettingsUpdate)
  }, [])

  const loadSiteSettings = async () => {
    try {
      const settings = await getUserSettings()
      setSiteName(settings.website_name || '导航')
      setLogoUrl(settings.logo_url || '')
    } catch (error) {
      console.error('Failed to load site settings:', error)
    }
  }

  return (
    <div className={`bg-bg-card border-r border-border-main flex flex-col flex-shrink-0 transition-all duration-200 ${
      isCollapsed ? 'w-14' : 'w-52'
    }`}>
      {/* 头部 */}
      <div className="p-3 border-b border-border-main flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded-lg object-contain" />
            ) : (
              <div className="h-7 w-7 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-white">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-sm font-medium text-text-main truncate">{siteName}</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-hover-bg text-text-secondary"
        >
          {isCollapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
      </div>

      {/* 分类列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* 全部 */}
        <button
          onClick={() => onCategorySelect(null)}
          className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
            selectedCategoryId === null
              ? 'bg-primary text-white'
              : 'text-text-main hover:bg-hover-bg'
          }`}
        >
          {isCollapsed ? (
            <span className="text-xs">全</span>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm">全部</span>
              <span className="text-xs opacity-70">{totalLinks}</span>
            </div>
          )}
        </button>

        {/* 分类 */}
        <div className="space-y-0.5">
          {isEditMode ? (
            <SortableProvider items={categories.map(cat => cat.id)}>
              {categories.map((category) => (
                <CategoryDropZone
                  key={category.id}
                  categoryId={category.id}
                  categoryName={category.name}
                  onLinkDrop={onLinkDrop}
                >
                  <DragHandle id={category.id} type="category" data={category}>
                    <CategoryButton
                      category={category}
                      isSelected={selectedCategoryId === category.id}
                      isCollapsed={isCollapsed}
                      onClick={() => onCategorySelect(category.id)}
                    />
                  </DragHandle>
                </CategoryDropZone>
              ))}
            </SortableProvider>
          ) : (
            categories.map((category) => (
              <CategoryDropZone
                key={category.id}
                categoryId={category.id}
                categoryName={category.name}
                onLinkDrop={onLinkDrop}
              >
                <CategoryButton
                  category={category}
                  isSelected={selectedCategoryId === category.id}
                  isCollapsed={isCollapsed}
                  onClick={() => onCategorySelect(category.id)}
                />
              </CategoryDropZone>
            ))
          )}
        </div>

        {/* 添加分类 */}
        <button
          onClick={onCreateCategory}
          className="w-full mt-2 px-3 py-2 border border-dashed border-border-main rounded-lg text-text-secondary hover:text-primary hover:border-primary transition-colors"
        >
          {isCollapsed ? (
            <PlusIcon className="h-4 w-4 mx-auto" />
          ) : (
            <div className="flex items-center justify-center gap-1">
              <PlusIcon className="h-4 w-4" />
              <span className="text-sm">添加分类</span>
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

function CategoryButton({
  category,
  isSelected,
  isCollapsed,
  onClick
}: {
  category: CategoryWithLinks
  isSelected: boolean
  isCollapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isSelected
          ? 'bg-primary text-white'
          : 'text-text-main hover:bg-hover-bg'
      }`}
    >
      {isCollapsed ? (
        <span className="text-xs">{category.name.charAt(0)}</span>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm truncate">{category.name}</span>
          <span className="text-xs opacity-70 ml-2">{category.links.length}</span>
        </div>
      )}
    </button>
  )
}
