    import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useEventListener } from '../hooks/useEventListener'
import { useDebounce } from '../hooks/useDebounce'
import { DragDropProvider, SortableProvider } from '../contexts/DragDropContext'
import { useDragOperations } from '../hooks/useDragOperations'
import { useDragFeedback } from '../components/DragFeedback'
import { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  PencilIcon,
  CheckIcon,
  Cog6ToothIcon,
  UserIcon,
  LinkIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  FolderIcon,
  PlusIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline'
import LinkCard from '../components/LinkCard'
import VirtualLinkGrid from '../components/VirtualLinkGrid'
import CategoryDropZone from '../components/CategoryDropZone'
import SortableCategoryItem from '../components/SortableCategoryItem'
import SettingsModule from '../components/SettingsModule'
import ConfirmModal from '../components/ConfirmModal'
import Footer from '../components/Footer'
import { LoadingSpinner, LoadingGrid, LinkCardSkeleton } from '../components/SkeletonLoader'
import api from '../utils/api'

// 懒加载模块
const NotesModule = lazy(() => import('../components/NotesModule'))
const ClipboardModule = lazy(() => import('../components/ClipboardModule'))

import { 
  getCategories,
  updateCategoryOrder,
  navigationAPI,
  recordLinkVisit,
  type CategoryWithLinks,
  type Link 
} from '../utils/api'
import { getUserSettings } from '../utils/settingsApi'

type ActiveTab = 'nav' | 'notes' | 'clipboard' | 'settings'

interface ModalState {
  type: 'addCategory' | 'editCategory' | 'addLink' | 'editLink' | null
  data?: any
}

interface DeleteConfirmState {
  isOpen: boolean
  type: 'category' | 'link' | null
  id: string
  name: string
}

const searchEngines = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  baidu: { name: '百度', url: 'https://www.baidu.com/s?wd=' },
  github: { name: 'GitHub', url: 'https://github.com/search?q=' },
  local: { name: '站内', url: '' }
}

export default function Home() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<CategoryWithLinks[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 从 sessionStorage 恢复 activeTab
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = sessionStorage.getItem('activeTab')
    return (saved as ActiveTab) || 'nav'
  })
  // 手机端默认关闭侧边栏，桌面端默认打开
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchEngine, setSearchEngine] = useState<keyof typeof searchEngines>('google')
  const [localSearchResults, setLocalSearchResults] = useState<Array<{ type: 'link' | 'note' | 'clipboard'; id: string; title: string; url?: string; desc: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  
  // 防抖搜索
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  
  // 弹窗状态
  const [modal, setModal] = useState<ModalState>({ type: null })
  const [formData, setFormData] = useState({ name: '', title: '', url: '', desc: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ isOpen: false, type: null, id: '', name: '' })
  
  // 网站设置
  const [siteName, setSiteName] = useState('qiankui导航')
  const [logoUrl, setLogoUrl] = useState('')
  
  // 深色模式
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })
  
  // 搜索数据状态
  const [notes, setNotes] = useState<Array<{ id: string; title: string; content: string }>>([])
  const [clipboardItems, setClipboardItems] = useState<Array<{ id: string; title: string; content: string; type: string }>>([])
  const highlightedRef = useRef<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  
  // 最近访问显示设置
  const [showRecentVisits, setShowRecentVisits] = useState(() => {
    return localStorage.getItem('showRecentVisits') !== 'false'
  })

  // 保存 activeTab 到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  // 保存滚动位置
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem(`scrollPos_${activeTab}`, String(window.scrollY))
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [activeTab])

  // 恢复滚动位置
  useEffect(() => {
    if (loading) return
    
    const savedPos = sessionStorage.getItem(`scrollPos_${activeTab}`)
    if (savedPos) {
      setTimeout(() => {
        window.scrollTo(0, Number(savedPos))
      }, 100)
    }
  }, [activeTab, loading])

  useEffect(() => { loadCategories(); loadSearchData(); loadSiteSettings() }, [])
  
  // 监听网站设置更新事件
  useEventListener('siteSettingsUpdated', useCallback(() => loadSiteSettings(), []))
  
  // 监听导航数据删除事件
  useEventListener('navigationDataDeleted', useCallback(() => setCategories([]), []))
  
  // 监听数据导入事件
  useEventListener('dataImported', useCallback(() => {
    loadCategories()
    loadSearchData()
  }, []))
  
  // 监听最近访问开关变化
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent
      setShowRecentVisits(customEvent.detail.show)
    }
    window.addEventListener('recentVisitsToggled', handleToggle)
    return () => window.removeEventListener('recentVisitsToggled', handleToggle)
  }, [])
  
  // 切换到站内搜索时重新加载数据
  useEffect(() => {
    if (searchEngine === 'local') {
      loadSearchData()
    }
  }, [searchEngine])
  
  // 全局搜索快捷键 - 切换到站内搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setActiveTab('nav')
        setSearchEngine('local')
        // 聚焦搜索框
        setTimeout(() => {
          const searchInput = document.querySelector('input[placeholder*="站内"]') as HTMLInputElement
          searchInput?.focus()
        }, 100)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getCategories()
      setCategories(data)
    } catch (err) {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }
  
  const loadSiteSettings = async () => {
    try {
      const settings = await getUserSettings()
      setSiteName(settings.website_name || 'qiankui导航')
      setLogoUrl(settings.logo_url || '')
      // 更新浏览器标题
      document.title = settings.website_name || 'qiankui导航'
      // 更新浏览器标签页图标 (favicon)
      updateFavicon(settings.logo_url || '')
    } catch (err) {
      console.error('Failed to load site settings:', err)
    }
  }

  // 动态更新 favicon
  const updateFavicon = (logoUrl: string) => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link')
    link.type = 'image/x-icon'
    link.rel = 'icon'
    if (logoUrl) {
      link.href = logoUrl
    } else {
      link.href = '/logo.png'
    }
    document.head.appendChild(link)
  }
  
  const loadSearchData = async () => {
    try {
      // 加载笔记
      const notesRes = await api.get('/api/notes')
      if (notesRes.data?.data) {
        setNotes(notesRes.data.data.map((n: any) => ({
          id: n.id,
          title: n.title || '',
          content: n.content || ''
        })))
      }
      // 加载剪贴板
      const clipRes = await api.get('/api/clipboard/items')
      if (clipRes.data?.data) {
        setClipboardItems(clipRes.data.data.map((c: any) => ({
          id: c.id,
          title: c.title || '',
          content: c.content || '',
          type: c.type || 'text'
        })))
      }
    } catch (err) {
      console.error('Error loading search data:', err)
    }
  }

  // 处理链接访问统计更新
  const handleVisitUpdate = useCallback((linkId: string, visitCount: number, lastVisitedAt: string) => {
    setCategories(prev => prev.map(cat => ({
      ...cat,
      links: cat.links.map(link => 
        link.id === linkId 
          ? { ...link, visitCount, lastVisitedAt }
          : link
      )
    })))
  }, [])
  
  const handleGlobalNavigate = (type: 'nav' | 'notes' | 'clipboard', targetId: string) => {
    setActiveTab(type)
    highlightedRef.current = targetId
    setHighlightId(targetId)
    
    // 延迟滚动到目标元素，使用统一的高亮样式
    setTimeout(() => {
      const el = document.querySelector(`[data-search-id="${targetId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('search-highlight')
        setTimeout(() => {
          el.classList.remove('search-highlight')
          setHighlightId(null)
        }, 2000)
      }
    }, 200)
  }

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }
  
  // 初始化深色模式
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark)
    
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
      setIsDarkMode(true)
    } else {
      document.documentElement.classList.remove('dark')
      setIsDarkMode(false)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    if (searchEngine === 'local') {
      // 站内搜索不需要打开新窗口
      return
    }
    window.open(searchEngines[searchEngine].url + encodeURIComponent(searchQuery.trim()), '_blank')
  }
  
  // 站内搜索逻辑
  const doLocalSearch = (query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setLocalSearchResults([])
      return
    }
    
    const results: Array<{ type: 'link' | 'note' | 'clipboard'; id: string; title: string; url?: string; desc: string }> = []
    
    // 搜索导航链接
    categories.forEach(cat => {
      cat.links.forEach(link => {
        if (
          link.title.toLowerCase().includes(q) ||
          (link.description && link.description.toLowerCase().includes(q)) ||
          link.url.toLowerCase().includes(q)
        ) {
          results.push({
            type: 'link',
            id: link.id,
            title: link.title,
            url: link.url,
            desc: cat.name + (link.description ? ' · ' + link.description : '')
          })
        }
      })
    })
    
    // 搜索笔记
    notes.forEach(note => {
      if (
        (note.title && note.title.toLowerCase().includes(q)) ||
        (note.content && note.content.toLowerCase().includes(q))
      ) {
        results.push({
          type: 'note',
          id: note.id,
          title: note.title || '无标题',
          desc: note.content ? note.content.substring(0, 60) + '...' : '空笔记'
        })
      }
    })
    
    // 搜索剪贴板
    clipboardItems.forEach(item => {
      const content = item.type === 'image' ? '[图片]' : item.content || ''
      if (
        content.toLowerCase().includes(q) ||
        (item.title && item.title.toLowerCase().includes(q))
      ) {
        results.push({
          type: 'clipboard',
          id: item.id,
          title: item.title || (item.type === 'code' ? '代码片段' : item.type === 'image' ? '图片' : '文本'),
          desc: content.substring(0, 60)
        })
      }
    })
    
    setLocalSearchResults(results.slice(0, 20))
  }
  
  // 监听搜索输入变化，站内搜索时实时搜索（使用防抖）
  useEffect(() => {
    if (searchEngine === 'local') {
      setIsSearching(true)
      doLocalSearch(debouncedSearchQuery)
      setIsSearching(false)
    } else {
      setLocalSearchResults([])
    }
  }, [debouncedSearchQuery, searchEngine, categories, notes, clipboardItems])
  
  // 点击站内搜索结果
  const handleLocalResultClick = (result: { type: 'link' | 'note' | 'clipboard'; id: string; url?: string }) => {
    if (result.type === 'link' && result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } else {
      handleGlobalNavigate(result.type === 'link' ? 'nav' : result.type === 'note' ? 'notes' : 'clipboard', result.id)
    }
  }

  // 打开添加分类弹窗
  const openAddCategory = () => {
    setFormData({ name: '', title: '', url: '', desc: '' })
    setModal({ type: 'addCategory' })
  }

  // 打开编辑分类弹窗
  const openEditCategory = (cat: CategoryWithLinks) => {
    setFormData({ name: cat.name, title: '', url: '', desc: '' })
    setModal({ type: 'editCategory', data: cat })
  }

  // 打开添加链接弹窗
  const openAddLink = (categoryId: string) => {
    setFormData({ name: '', title: '', url: '', desc: '' })
    setModal({ type: 'addLink', data: { categoryId } })
  }

  // 打开编辑链接弹窗
  const openEditLink = (link: Link) => {
    setFormData({ name: '', title: link.title, url: link.url, desc: link.description || '' })
    setModal({ type: 'editLink', data: link })
  }

  // 关闭弹窗
  const closeModal = () => {
    setModal({ type: null })
    setFormData({ name: '', title: '', url: '', desc: '' })
  }

  // 保存分类
  const saveCategory = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    try {
      if (modal.type === 'addCategory') {
        const result = await navigationAPI.createCategory(formData.name.trim(), categories.length)
        // 重新加载分类以获取完整数据
        if (result.data) {
          await loadCategories()
        }
        showSuccess('分类已添加')
      } else if (modal.type === 'editCategory' && modal.data) {
        await navigationAPI.updateCategory(modal.data.id, { name: formData.name.trim() })
        // 乐观更新：直接更新本地状态
        setCategories(prev => prev.map(c => c.id === modal.data.id ? { ...c, name: formData.name.trim() } : c))
        showSuccess('分类已更新')
      }
      closeModal()
    } catch {
      showError('保存失败')
      loadCategories() // 失败时重新加载
    } finally {
      setSaving(false)
    }
  }

  // 删除分类
  const deleteCategory = async (categoryId: string, categoryName: string) => {
    setDeleteConfirm({ isOpen: true, type: 'category', id: categoryId, name: categoryName })
  }

  const confirmDeleteCategory = async () => {
    const categoryId = deleteConfirm.id
    try {
      await navigationAPI.deleteCategory(categoryId)
      // 乐观更新：直接从本地状态删除
      setCategories(prev => prev.filter(c => c.id !== categoryId))
      showSuccess('分类已删除')
    } catch {
      showError('删除失败')
      loadCategories() // 失败时重新加载
    } finally {
      setDeleteConfirm({ isOpen: false, type: null, id: '', name: '' })
    }
  }

  // 保存链接
  const saveLink = async () => {
    if (!formData.title.trim() || !formData.url.trim()) return
    setSaving(true)
    try {
      // 自动补全 URL
      let url = formData.url.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
      
      if (modal.type === 'addLink' && modal.data?.categoryId) {
        const category = categories.find(c => c.id === modal.data.categoryId)
        const result = await navigationAPI.createLink({
          categoryId: modal.data.categoryId,
          title: formData.title.trim(),
          url,
          description: formData.desc.trim() || undefined,
          order: category ? category.links.length : 0
        })
        // 重新加载分类以获取完整数据
        if (result.data) {
          await loadCategories()
        }
        showSuccess('链接已添加')
      } else if (modal.type === 'editLink' && modal.data) {
        await navigationAPI.updateLink(modal.data.id, {
          title: formData.title.trim(),
          url,
          description: formData.desc.trim() || undefined
        })
        // 乐观更新：直接更新本地状态
        setCategories(prev => prev.map(c => ({
          ...c,
          links: c.links.map(l => l.id === modal.data.id 
            ? { ...l, title: formData.title.trim(), url, description: formData.desc.trim() || undefined }
            : l
          )
        })))
        showSuccess('链接已更新')
      }
      closeModal()
    } catch {
      showError('保存失败')
      loadCategories() // 失败时重新加载
    } finally {
      setSaving(false)
    }
  }

  // 删除链接
  const deleteLink = async (linkId: string, linkTitle: string) => {
    setDeleteConfirm({ isOpen: true, type: 'link', id: linkId, name: linkTitle })
  }

  const confirmDeleteLink = async () => {
    const linkId = deleteConfirm.id
    try {
      await navigationAPI.deleteLink(linkId)
      // 乐观更新：直接从本地状态删除
      setCategories(prev => prev.map(c => ({
        ...c,
        links: c.links.filter(l => l.id !== linkId)
      })))
      showSuccess('链接已删除')
    } catch {
      showError('删除失败')
      loadCategories() // 失败时重新加载
    } finally {
      setDeleteConfirm({ isOpen: false, type: null, id: '', name: '' })
    }
  }

  const handleConfirmDelete = () => {
    if (deleteConfirm.type === 'category') {
      confirmDeleteCategory()
    } else if (deleteConfirm.type === 'link') {
      confirmDeleteLink()
    }
  }

  // 分类拖拽处理 (使用 dnd-kit)
  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    
    // 检查是否是分类拖拽
    if (active.data.current?.type !== 'category') return
    
    const oldIndex = categories.findIndex(c => c.id === active.id)
    const newIndex = categories.findIndex(c => c.id === over.id)
    
    if (oldIndex === -1 || newIndex === -1) return
    
    const newCategories = arrayMove(categories, oldIndex, newIndex)
    setCategories(newCategories)
    
    try {
      await updateCategoryOrder(newCategories.map(c => c.id))
      showSuccess('分类已移动')
    } catch {
      showError('移动失败')
      loadCategories()
    }
  }

  const { showSuccess, showError, NotificationContainer } = useDragFeedback()
  const { isDragInProgress, handleDragStart, handleDragEnd, handleDragCancel } = useDragOperations({
    categories, setCategories, onSuccess: showSuccess,
    onError: (msg) => { showError(msg); loadCategories() }
  })

  const displayCategories = selectedCategoryId ? categories.filter(c => c.id === selectedCategoryId) : categories
  const totalLinks = categories.reduce((s, c) => s + c.links.length, 0)

  if (loading) return (
    <div className="min-h-screen bg-bg-main flex">
      {/* 侧边栏骨架 - 只在桌面端显示 */}
      <div className="hidden lg:block w-60 bg-bg-card border-r border-border-main p-4">
        {[1,2,3,4].map(i => <div key={i} className="h-10 bg-hover-bg rounded-lg animate-pulse mb-2" />)}
      </div>
      <div className="flex-1 p-6"><LoadingGrid ItemComponent={LinkCardSkeleton} /></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={loadCategories} className="px-4 py-2 bg-primary text-white rounded-lg">重试</button>
      </div>
    </div>
  )

  return (
    <>
      <NotificationContainer />
      
      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.type === 'category' ? '删除分类' : '删除链接'}
        message={deleteConfirm.type === 'category' 
          ? `确定删除分类 "${deleteConfirm.name}"？该分类下的所有链接也会被删除。`
          : `确定删除 "${deleteConfirm.name}"？`
        }
        confirmText="删除"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, type: null, id: '', name: '' })}
      />
      
      {/* 弹窗 */}
      {modal.type && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-bg-card rounded-xl p-5 w-full max-w-sm border border-border-main shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-main">
                {modal.type === 'addCategory' && '添加分类'}
                {modal.type === 'editCategory' && '编辑分类'}
                {modal.type === 'addLink' && '添加链接'}
                {modal.type === 'editLink' && '编辑链接'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-hover-bg rounded-lg">
                <XMarkIcon className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
            
            {(modal.type === 'addCategory' || modal.type === 'editCategory') && (
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="分类名称"
                  className="w-full px-3 py-2.5 text-sm border border-border-main rounded-lg bg-bg-main text-text-main placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-border-main rounded-lg text-text-main hover:bg-hover-bg">
                    取消
                  </button>
                  <button onClick={saveCategory} disabled={saving || !formData.name.trim()} className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50">
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            )}
            
            {(modal.type === 'addLink' || modal.type === 'editLink') && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="网站名称"
                  className="w-full px-3 py-2.5 text-sm border border-border-main rounded-lg bg-bg-main text-text-main placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoFocus
                />
                <input
                  type="text"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  placeholder="网址 (如: google.com)"
                  className="w-full px-3 py-2.5 text-sm border border-border-main rounded-lg bg-bg-main text-text-main placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <input
                  type="text"
                  value={formData.desc}
                  onChange={e => setFormData({ ...formData, desc: e.target.value })}
                  placeholder="备注 (可选)"
                  className="w-full px-3 py-2.5 text-sm border border-border-main rounded-lg bg-bg-main text-text-main placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <div className="flex gap-3 pt-1">
                  <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-border-main rounded-lg text-text-main hover:bg-hover-bg">
                    取消
                  </button>
                  <button onClick={saveLink} disabled={saving || !formData.title.trim() || !formData.url.trim()} className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50">
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <DragDropProvider onDragStart={handleDragStart} onDragEnd={(e) => { handleDragEnd(e); handleCategoryDragEnd(e); }} onDragCancel={handleDragCancel}>
        <div className={`min-h-screen bg-bg-main flex ${isDragInProgress ? 'select-none' : ''}`}>
          {/* 侧边栏 */}
          <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-bg-card border-r border-border-main flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div 
              className="h-14 flex items-center gap-3 px-4 border-b border-border-main cursor-pointer hover:bg-hover-bg transition-colors"
              onClick={() => window.location.href = '/'}
              title="返回首页"
            >
              <img src={logoUrl || '/logo.png'} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
              <span className="font-semibold text-text-main">{siteName}</span>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
              <button onClick={() => setSelectedCategoryId(null)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedCategoryId === null ? 'bg-primary text-white font-medium' : 'text-text-main hover:bg-hover-bg'}`}>
                全部 ({totalLinks})
              </button>
              <SortableProvider items={categories.map(c => c.id)} strategy="vertical">
                {categories.map((cat) => (
                  <SortableCategoryItem
                    key={cat.id}
                    category={cat}
                    isSelected={selectedCategoryId === cat.id && activeTab === 'nav'}
                    isEditMode={isEditMode}
                    onClick={() => {
                      // 如果不在导航 tab，先切换到导航 tab
                      if (activeTab !== 'nav') {
                        setActiveTab('nav')
                      }
                      setSelectedCategoryId(cat.id)
                      // 关闭移动端侧边栏
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false)
                      }
                    }}
                  />
                ))}
              </SortableProvider>
            </nav>
            <div className="h-14 px-4 border-t border-border-main flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <UserIcon className="w-4 h-4" /><span>{user?.username}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleDarkMode} className="w-8 h-8 rounded-lg bg-hover-bg flex items-center justify-center hover:bg-border-main" title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}>
                  {isDarkMode ? <SunIcon className="w-4 h-4 text-text-secondary" /> : <MoonIcon className="w-4 h-4 text-text-secondary" />}
                </button>
                <button onClick={() => { setActiveTab('settings'); setSidebarOpen(false) }} className="w-8 h-8 rounded-lg bg-hover-bg flex items-center justify-center hover:bg-border-main" title="设置">
                  <Cog6ToothIcon className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
            </div>
          </aside>

          {/* 主内容 */}
          <div className="lg:ml-60 flex-1 flex flex-col min-h-screen">
            <header className="sticky top-0 z-20 bg-bg-card border-b border-border-main px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden w-9 h-9 rounded-lg hover:bg-hover-bg flex items-center justify-center">
                  <Bars3Icon className="w-5 h-5 text-text-main" />
                </button>
                <div className="flex gap-1 bg-hover-bg rounded-lg p-1">
                  <button onClick={() => setActiveTab('nav')} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${activeTab === 'nav' ? 'bg-bg-card text-text-main shadow-sm font-medium' : 'text-text-secondary hover:text-text-main'}`}>
                    <LinkIcon className="w-4 h-4" />导航
                  </button>
                  <button onClick={() => setActiveTab('notes')} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${activeTab === 'notes' ? 'bg-bg-card text-text-main shadow-sm font-medium' : 'text-text-secondary hover:text-text-main'}`}>
                    <DocumentTextIcon className="w-4 h-4" />笔记
                  </button>
                  <button onClick={() => setActiveTab('clipboard')} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${activeTab === 'clipboard' ? 'bg-bg-card text-text-main shadow-sm font-medium' : 'text-text-secondary hover:text-text-main'}`}>
                    <ClipboardDocumentListIcon className="w-4 h-4" />便签
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'nav' && (
                  <button onClick={() => setIsEditMode(!isEditMode)} className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 ${isEditMode ? 'bg-primary text-white' : 'bg-hover-bg text-text-main hover:bg-border-main'}`}>
                    {isEditMode ? <><CheckIcon className="w-4 h-4" /><span className="hidden sm:inline">完成</span></> : <><PencilIcon className="w-4 h-4" /><span className="hidden sm:inline">编辑</span></>}
                  </button>
                )}
              </div>
            </header>

            <main className="flex-1 p-4 lg:p-6" style={{ overflowX: 'hidden' }}>
              {activeTab === 'nav' && (
                <>
                  <div className="max-w-2xl mx-auto mb-8">
                    <div className="flex justify-center gap-2 mb-4">
                      {Object.entries(searchEngines).map(([k, e]) => (
                        <button key={k} onClick={() => setSearchEngine(k as keyof typeof searchEngines)} className={`px-3 py-1.5 text-sm rounded-lg ${searchEngine === k ? 'bg-primary text-white' : 'bg-hover-bg text-text-secondary hover:text-text-main'}`}>{e.name}</button>
                      ))}
                    </div>
                    <form onSubmit={handleSearch} className="relative">
                      <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={searchEngine === 'local' ? '搜索站内内容...' : `搜索 ${searchEngines[searchEngine].name}...`} className="w-full pl-10 pr-20 py-3 bg-bg-card border border-border-main rounded-xl text-text-main placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                      <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                      {searchEngine !== 'local' && (
                        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium">搜索</button>
                      )}
                      {searchEngine === 'local' && isSearching && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                        </div>
                      )}
                    </form>
                    
                    {/* 站内搜索结果 */}
                    {searchEngine === 'local' && searchQuery.trim() && (
                      <div className="mt-4">
                        {localSearchResults.length === 0 ? (
                          <div className="text-center py-8 text-text-secondary text-sm">没有找到相关内容</div>
                        ) : (
                          <>
                            <div className="text-sm text-text-secondary mb-3">找到 {localSearchResults.length} 个结果</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {localSearchResults.map(result => (
                                <div
                                  key={`${result.type}-${result.id}`}
                                  onClick={() => handleLocalResultClick(result)}
                                  className="group relative bg-bg-card border border-border-main rounded-lg p-3 cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex-shrink-0">
                                      {result.type === 'link' && result.url ? (
                                        <img
                                          src={`https://www.google.com/s2/favicons?sz=64&domain=${new URL(result.url).hostname}`}
                                          alt=""
                                          className="h-8 w-8 rounded object-cover"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement
                                            target.style.display = 'none'
                                            target.nextElementSibling?.classList.remove('hidden')
                                          }}
                                        />
                                      ) : null}
                                      <div className={`h-8 w-8 rounded flex items-center justify-center ${
                                        result.type === 'link' ? 'bg-primary/10 hidden' : 
                                        result.type === 'note' ? 'bg-green-100' : 'bg-indigo-100'
                                      }`}>
                                        {result.type === 'link' && <LinkIcon className="h-4 w-4 text-primary" />}
                                        {result.type === 'note' && <DocumentTextIcon className="h-4 w-4 text-green-600" />}
                                        {result.type === 'clipboard' && <ClipboardDocumentListIcon className="h-4 w-4 text-indigo-600" />}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm font-medium text-text-main truncate group-hover:text-primary transition-colors">{result.title}</h3>
                                      <p className="text-xs text-text-secondary truncate">{result.desc}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 最近访问 - 只在非搜索状态且有访问记录时显示 */}
                  {showRecentVisits && (searchEngine !== 'local' || !searchQuery.trim()) && !selectedCategoryId && !isEditMode && (() => {
                    const recentLinks = categories
                      .flatMap(cat => cat.links.map(link => ({ ...link, categoryName: cat.name })))
                      .filter(link => link.lastVisitedAt)
                      .sort((a, b) => new Date(b.lastVisitedAt!).getTime() - new Date(a.lastVisitedAt!).getTime())
                      .slice(0, 8)
                    
                    if (recentLinks.length === 0) return null
                    
                    return (
                      <div className="max-w-6xl mx-auto mb-8">
                        <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          最近访问
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                          {recentLinks.map(link => (
                            <a
                              key={link.id}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                recordLinkVisit(link.id).then(data => {
                                  if (data) handleVisitUpdate(link.id, data.visitCount, data.lastVisitedAt)
                                })
                              }}
                              className="flex items-center gap-2 p-2 bg-bg-card border border-border-main rounded-lg hover:border-primary/30 hover:shadow-sm transition-all group"
                            >
                              <img
                                src={`https://www.google.com/s2/favicons?sz=32&domain=${new URL(link.url).hostname}`}
                                alt=""
                                className="w-5 h-5 rounded flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/logo.png'
                                }}
                              />
                              <span className="text-xs text-text-main truncate group-hover:text-primary transition-colors">{link.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* 只有非站内搜索或搜索为空时显示分类 */}
                  {(searchEngine !== 'local' || !searchQuery.trim()) && (
                  <div className="max-w-6xl mx-auto space-y-8">
                    {displayCategories.map((cat) => (
                      <CategoryDropZone key={cat.id} categoryId={cat.id} categoryName={cat.name} isEditMode={isEditMode}>
                        <section>
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-text-main">
                              {cat.name} <span className="text-sm font-normal text-text-secondary">({cat.links.length})</span>
                            </h2>
                            {isEditMode && (
                              <div className="flex items-center gap-2">
                                <button onClick={() => openEditCategory(cat)} className="text-sm text-primary hover:underline font-medium">
                                  编辑
                                </button>
                                <button onClick={() => deleteCategory(cat.id, cat.name)} className="text-sm text-red-500 hover:underline font-medium">
                                  删除
                                </button>
                              </div>
                            )}
                          </div>
                          {/* 编辑模式使用 SortableProvider 支持拖拽，非编辑模式且链接多时使用虚拟滚动 */}
                          {isEditMode ? (
                            <SortableProvider items={cat.links.map(l => l.id)} strategy="horizontal">
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {cat.links.map(l => (
                                  <div key={l.id} data-search-id={l.id}>
                                    <LinkCard 
                                      link={l} 
                                      isEditMode={isEditMode} 
                                      onEdit={openEditLink} 
                                      onDelete={(linkId) => deleteLink(linkId, l.title)}
                                      onVisitUpdate={handleVisitUpdate}
                                    />
                                  </div>
                                ))}
                                <button
                                  onClick={() => openAddLink(cat.id)}
                                  className="bg-bg-card border border-dashed border-border-main rounded-lg p-3 text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 border border-dashed border-current rounded flex items-center justify-center flex-shrink-0">
                                      <PlusIcon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                      <span className="text-sm font-medium block">添加链接</span>
                                    </div>
                                  </div>
                                </button>
                              </div>
                            </SortableProvider>
                          ) : (
                            <VirtualLinkGrid
                              links={cat.links}
                              isEditMode={false}
                              onEdit={openEditLink}
                              onDelete={(linkId) => {
                                const link = cat.links.find(l => l.id === linkId)
                                if (link) deleteLink(linkId, link.title)
                              }}
                              onVisitUpdate={handleVisitUpdate}
                            />
                          )}
                          {cat.links.length === 0 && !isEditMode && (
                            <div className="text-center py-8 text-text-secondary">此分类暂无链接</div>
                          )}
                        </section>
                      </CategoryDropZone>
                    ))}
                    
                    {/* 编辑模式下显示添加分类按钮 */}
                    {isEditMode && (
                      <button
                        onClick={openAddCategory}
                        className="w-full py-4 border-2 border-dashed border-border-main rounded-xl text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <PlusIcon className="w-5 h-5" />
                        添加新分类
                      </button>
                    )}
                    
                    {displayCategories.length === 0 && !isEditMode && (
                      <div className="text-center py-16">
                        <FolderIcon className="w-16 h-16 mx-auto text-text-secondary mb-4" />
                        <h3 className="text-lg font-medium text-text-main mb-2">暂无链接</h3>
                        <p className="text-sm text-text-secondary">点击编辑按钮添加分类和链接</p>
                      </div>
                    )}
                  </div>
                  )}
                </>
              )}
              {activeTab === 'notes' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <NotesModule highlightId={highlightId} />
                </Suspense>
              )}
              {activeTab === 'clipboard' && (
                <Suspense fallback={<LoadingSpinner />}>
                  <ClipboardModule highlightId={highlightId} />
                </Suspense>
              )}
              {activeTab === 'settings' && <SettingsModule />}
            </main>
            <Footer />
          </div>
          {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        </div>
      </DragDropProvider>
    </>
  )
}
