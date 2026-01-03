import { memo } from 'react'
import LinkCard from './LinkCard'
import { Link } from '../utils/api'

interface VirtualLinkGridProps {
  links: Link[]
  isEditMode: boolean
  onEdit: (link: Link) => void
  onDelete: (linkId: string) => void
  onVisitUpdate?: (linkId: string, visitCount: number, lastVisitedAt: string) => void
  onAddLink?: () => void
}

// 简化版本：直接渲染所有链接，不使用虚拟滚动
// react-window v2 API 变化较大，暂时使用普通渲染
export default memo(function VirtualLinkGrid({
  links,
  isEditMode,
  onEdit,
  onDelete,
  onVisitUpdate,
  onAddLink
}: VirtualLinkGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {links.map(link => (
        <div key={link.id} data-search-id={link.id}>
          <LinkCard
            link={link}
            isEditMode={isEditMode}
            onEdit={onEdit}
            onDelete={(linkId) => onDelete(linkId)}
            onVisitUpdate={onVisitUpdate}
          />
        </div>
      ))}
      {isEditMode && onAddLink && (
        <button
          onClick={onAddLink}
          className="bg-bg-card border border-dashed border-border-main rounded-lg p-3 text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 border border-dashed border-current rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="text-sm font-medium block">添加链接</span>
            </div>
          </div>
        </button>
      )}
    </div>
  )
})
