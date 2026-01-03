import { useState, useEffect, useRef } from 'react'
import {
  CircleStackIcon,
  LockClosedIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  PhotoIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  SwatchIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline'
import ConfirmModal from './ConfirmModal'
import api from '../utils/api'
import {
  downloadExportData,
  importUserData,
  updateUserCredentials,
  getExportStats,
  getUserSettings,
  updateUserSettings,
  type ExportStats,
  type ExportData
} from '../utils/settingsApi'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

export default function SettingsModule() {
  const { logout, user } = useAuth()
  const { showSuccess, showError, ToastContainer } = useToast()
  const [exportStats, setExportStats] = useState<ExportStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  // 主题配色
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('colorTheme') || 'warm-brown'
  })
  
  // 最近访问显示开关
  const [showRecentVisits, setShowRecentVisits] = useState(() => {
    return localStorage.getItem('showRecentVisits') !== 'false'
  })
  
  const themes = [
    { id: 'warm-brown', name: '温暖棕', colors: ['#faf8f5', '#a67c52', '#8b6642'] },
    { id: 'cream-black', name: '素雅白', colors: ['#fefdfb', '#333333', '#1a1a1a'] },
    { id: 'ocean-blue', name: '海洋蓝', colors: ['#f0f7ff', '#3b82f6', '#1e3a5f'] },
    { id: 'forest-green', name: '森林绿', colors: ['#f0f7f4', '#059669', '#1a4d3e'] },
    { id: 'rose-pink', name: '玫瑰粉', colors: ['#fdf2f4', '#ec4899', '#831843'] },
    { id: 'violet-purple', name: '紫罗兰', colors: ['#f5f3ff', '#8b5cf6', '#4c1d95'] },
  ]
  
  // 网站设置
  const [websiteName, setWebsiteName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [savingSite, setSavingSite] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  
  // 账号安全
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  
  // 危险区域
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    type: 'navigation' | 'notes' | 'clipboard' | null
    title: string
    message: string
  }>({ isOpen: false, type: null, title: '', message: '' })
  
  // 书签导入
  const [importingBookmarks, setImportingBookmarks] = useState(false)
  const bookmarkInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [stats, settings] = await Promise.all([
        getExportStats(),
        getUserSettings()
      ])
      setExportStats(stats)
      setWebsiteName(settings.website_name || '')
      setLogoUrl(settings.logo_url || '')
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 应用主题
  const applyTheme = (themeId: string) => {
    setCurrentTheme(themeId)
    localStorage.setItem('colorTheme', themeId)
    
    if (themeId === 'warm-brown') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', themeId)
    }
  }

  // 切换最近访问显示
  const toggleRecentVisits = (show: boolean) => {
    setShowRecentVisits(show)
    localStorage.setItem('showRecentVisits', show ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent('recentVisitsToggled', { detail: { show } }))
  }

  // 初始化主题
  useEffect(() => {
    const savedTheme = localStorage.getItem('colorTheme') || 'warm-brown'
    if (savedTheme !== 'warm-brown') {
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

  // 解析浏览器书签 HTML 文件
  const parseBookmarksHtml = (html: string): { folders: { name: string; links: { title: string; url: string }[] }[] } => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const folders: { name: string; links: { title: string; url: string }[] }[] = []
    
    // 查找所有 DL 元素（书签文件夹容器）
    const processDL = (dl: Element, folderName: string = '导入的书签') => {
      const links: { title: string; url: string }[] = []
      const children = dl.children
      
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.tagName === 'DT') {
          const h3 = child.querySelector(':scope > H3')
          const a = child.querySelector(':scope > A')
          const subDl = child.querySelector(':scope > DL')
          
          if (h3 && subDl) {
            // 这是一个文件夹
            processDL(subDl, h3.textContent || '未命名文件夹')
          } else if (a) {
            // 这是一个链接
            const href = a.getAttribute('HREF')
            const title = a.textContent || ''
            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
              links.push({ title: title || new URL(href).hostname, url: href })
            }
          }
        }
      }
      
      if (links.length > 0) {
        folders.push({ name: folderName, links })
      }
    }
    
    const rootDL = doc.querySelector('DL')
    if (rootDL) {
      processDL(rootDL)
    }
    
    return { folders }
  }

  // 导入书签
  const handleBookmarkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      setImportingBookmarks(true)
      const html = await file.text()
      const { folders } = parseBookmarksHtml(html)
      
      if (folders.length === 0) {
        showError('未找到有效的书签')
        return
      }
      
      let totalLinks = 0
      let totalCategories = 0
      
      // 为每个文件夹创建分类并添加链接
      for (const folder of folders) {
        try {
          // 创建分类
          const catResult = await api.post('/api/navigation/categories', {
            name: folder.name,
            order: 999 // 放到最后
          })
          
          if (catResult.data?.data?.id) {
            totalCategories++
            const categoryId = catResult.data.data.id
            
            // 添加链接
            for (let i = 0; i < folder.links.length; i++) {
              const link = folder.links[i]
              try {
                await api.post('/api/navigation/links', {
                  categoryId,
                  title: link.title,
                  url: link.url,
                  order: i
                })
                totalLinks++
              } catch (e) {
                console.error('Failed to import link:', link.title, e)
              }
            }
          }
        } catch (e) {
          console.error('Failed to create category:', folder.name, e)
        }
      }
      
      showSuccess(`成功导入 ${totalCategories} 个分类，${totalLinks} 个链接`)
      loadData()
      window.dispatchEvent(new CustomEvent('dataImported'))
    } catch (error) {
      console.error('Bookmark import error:', error)
      showError('书签文件解析失败')
    } finally {
      setImportingBookmarks(false)
      if (bookmarkInputRef.current) {
        bookmarkInputRef.current.value = ''
      }
    }
  }

  const handleSiteSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!websiteName.trim()) {
      showError('网站名称不能为空')
      return
    }
    try {
      setSavingSite(true)
      await updateUserSettings({
        website_name: websiteName.trim(),
        logo_url: logoUrl
      })
      showSuccess('保存成功')
      // 触发页面刷新以更新侧边栏
      window.dispatchEvent(new CustomEvent('siteSettingsUpdated'))
    } catch (error: any) {
      showError(error.message || '保存失败')
    } finally {
      setSavingSite(false)
    }
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      showError('请选择图片文件')
      return
    }
    
    // 检查文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('图片大小不能超过 5MB')
      return
    }
    
    // 转换为 Base64
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setLogoUrl(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoUrl('')
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  const handleExport = async () => {
    try {
      await downloadExportData()
      showSuccess('导出成功')
    } catch (error) {
      showError('导出失败')
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data: ExportData = JSON.parse(text)
      const result = await importUserData(data)
      result.success ? showSuccess(result.message) : showError(result.message)
      if (result.success) {
        // 延迟刷新数据，让消息提示先显示
        setTimeout(() => {
          loadData()
          window.dispatchEvent(new CustomEvent('dataImported'))
        }, 800)
      }
    } catch (error) {
      showError('导入失败')
    }
  }

  const handleAccountSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentPassword) {
      showError('请输入当前密码')
      return
    }
    
    // 检查是否有修改
    if (!newUsername.trim() && !newPassword) {
      showError('请输入新用户名或新密码')
      return
    }
    
    // 如果修改密码，检查确认密码
    if (newPassword && newPassword !== confirmPassword) {
      showError('两次密码不一致')
      return
    }
    
    if (newPassword && newPassword.length < 6) {
      showError('新密码至少6位')
      return
    }
    
    try {
      setSaving(true)
      await updateUserCredentials(
        currentPassword, 
        newPassword || undefined, 
        newUsername.trim() || undefined
      )
      showSuccess('修改成功，请重新登录')
      setCurrentPassword('')
      setNewUsername('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => logout(), 1500)
    } catch (error: any) {
      showError(error.message || '修改失败')
    } finally {
      setSaving(false)
    }
  }

  // 危险区域删除操作
  const openDeleteConfirm = (type: 'navigation' | 'notes' | 'clipboard') => {
    const configs = {
      navigation: { title: '删除所有导航', message: '确定删除所有分类和链接？此操作不可恢复！' },
      notes: { title: '删除所有笔记', message: '确定删除所有笔记？此操作不可恢复！' },
      clipboard: { title: '删除所有剪贴板', message: '确定删除所有剪贴板内容？此操作不可恢复！' }
    }
    setDeleteConfirm({ isOpen: true, type, ...configs[type] })
  }

  const handleBulkDelete = async () => {
    if (!deleteConfirm.type) return
    
    try {
      const endpoints = {
        navigation: '/api/navigation/all',
        notes: '/api/notes/all/items',
        clipboard: '/api/clipboard/all/items'
      }
      await api.delete(endpoints[deleteConfirm.type])
      showSuccess('删除成功')
      loadData()
      // 根据删除类型触发对应的更新事件
      if (deleteConfirm.type === 'navigation') {
        window.dispatchEvent(new CustomEvent('navigationDataDeleted'))
      }
      window.dispatchEvent(new CustomEvent('siteSettingsUpdated'))
    } catch (error) {
      showError('删除失败')
    } finally {
      setDeleteConfirm({ isOpen: false, type: null, title: '', message: '' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <ToastContainer />

      <div className="max-w-2xl mx-auto p-5 space-y-5">

        {/* 网站设置 */}
        <section className="bg-bg-card border border-border-main rounded-xl p-5">
          <h3 className="text-base font-medium text-text-main mb-4 flex items-center gap-2">
            <Cog6ToothIcon className="w-5 h-5" />
            网站设置
          </h3>
          
          <form onSubmit={handleSiteSave} className="space-y-3">
            <div>
              <div className="text-xs text-text-secondary mb-2">网站名称</div>
              <input
                type="text"
                value={websiteName}
                onChange={(e) => setWebsiteName(e.target.value)}
                placeholder="输入网站名称"
                className="w-full px-3 py-2 text-sm border border-border-main rounded-lg bg-bg-main text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            
            <div>
              <div className="text-xs text-text-secondary mb-2">网站 Logo（可选，留空使用文字图标）</div>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div className="relative">
                    <img 
                      src={logoUrl} 
                      alt="Logo预览" 
                      className="w-12 h-12 rounded-lg object-contain bg-bg-main border border-border-main"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-bg-main border border-dashed border-border-main flex items-center justify-center">
                    <PhotoIcon className="w-6 h-6 text-text-secondary" />
                  </div>
                )}
                <label className="flex-1 px-3 py-2 text-sm border border-border-main rounded-lg bg-bg-main text-text-secondary hover:bg-hover-bg transition-colors cursor-pointer text-center">
                  {logoUrl ? '更换图片' : '上传图片'}
                  <input 
                    ref={logoInputRef}
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
              <div className="text-xs text-text-secondary mt-2">支持 JPG、PNG、GIF，最大 5MB</div>
            </div>
            
            <button
              type="submit"
              disabled={savingSite}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm"
            >
              {savingSite ? '保存中...' : '保存设置'}
            </button>
          </form>
          
          {/* 最近访问开关 */}
          <div className="mt-4 pt-4 border-t border-border-main">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-text-main">显示最近访问</div>
                <div className="text-xs text-text-secondary">在首页显示最近访问的链接</div>
              </div>
              <button
                onClick={() => toggleRecentVisits(!showRecentVisits)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  showRecentVisits ? 'bg-primary' : 'bg-border-main'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    showRecentVisits ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* 主题配色 */}
        <section className="bg-bg-card border border-border-main rounded-xl p-5">
          <h3 className="text-base font-medium text-text-main mb-4 flex items-center gap-2">
            <SwatchIcon className="w-5 h-5" />
            主题配色
          </h3>
          
          <div className="grid grid-cols-3 gap-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                className={`relative p-3 rounded-xl border-2 transition-all ${
                  currentTheme === theme.id
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border-main hover:border-primary/50'
                }`}
              >
                <div className="flex gap-1 mb-2 justify-center">
                  {theme.colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border border-gray-200"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="text-xs text-text-main font-medium">{theme.name}</div>
                {currentTheme === theme.id && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="text-xs text-text-secondary mt-3">选择后立即生效，配合深色/浅色模式使用</div>
        </section>

        {/* 数据管理 */}
        <section className="bg-bg-card border border-border-main rounded-xl p-5">
          <h3 className="text-base font-medium text-text-main mb-4 flex items-center gap-2">
            <CircleStackIcon className="w-5 h-5" />
            数据管理
          </h3>
          
          {exportStats && (
            <div className="mb-4 p-3 bg-bg-main rounded-lg">
              <div className="grid grid-cols-4 gap-4 text-center text-sm">
                <div>
                  <div className="font-medium text-text-main">{exportStats.categories}</div>
                  <div className="text-xs text-text-secondary">分类</div>
                </div>
                <div>
                  <div className="font-medium text-text-main">{exportStats.links}</div>
                  <div className="text-xs text-text-secondary">链接</div>
                </div>
                <div>
                  <div className="font-medium text-text-main">{exportStats.notes}</div>
                  <div className="text-xs text-text-secondary">笔记</div>
                </div>
                <div>
                  <div className="font-medium text-text-main">{exportStats.clipboard_items}</div>
                  <div className="text-xs text-text-secondary">剪切板</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm flex items-center justify-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              导出数据
            </button>
            <label className="flex-1 px-4 py-2 bg-bg-main text-text-main border border-border-main rounded-lg hover:bg-hover-bg transition-colors cursor-pointer text-center text-sm flex items-center justify-center gap-2">
              <ArrowUpTrayIcon className="w-4 h-4" />
              导入数据
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
          
          {/* 书签导入 */}
          <div className="mt-4 pt-4 border-t border-border-main">
            <div className="text-xs text-text-secondary mb-2">从浏览器导入书签</div>
            <label className={`w-full px-4 py-2.5 bg-bg-main text-text-main border border-border-main rounded-lg hover:bg-hover-bg transition-colors cursor-pointer text-sm flex items-center justify-center gap-2 ${importingBookmarks ? 'opacity-50 pointer-events-none' : ''}`}>
              <BookmarkIcon className="w-4 h-4" />
              {importingBookmarks ? '导入中...' : '导入浏览器书签'}
              <input 
                ref={bookmarkInputRef}
                type="file" 
                accept=".html,.htm" 
                onChange={handleBookmarkImport} 
                className="hidden" 
                disabled={importingBookmarks}
              />
            </label>
            <div className="text-xs text-text-secondary mt-2">
              支持 Chrome、Edge、Firefox 导出的书签文件（HTML 格式）
            </div>
          </div>
        </section>

        {/* 账号安全 */}
        <section className="bg-bg-card border border-border-main rounded-xl p-5">
          <h3 className="text-base font-medium text-text-main mb-4 flex items-center gap-2">
            <LockClosedIcon className="w-5 h-5" />
            账号安全
          </h3>
          
          <div className="mb-4 text-sm text-text-secondary">
            当前账号: {user?.username || 'admin'}
          </div>
          
          <form onSubmit={handleAccountSave} className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="当前密码（必填）"
              className="w-full px-3 py-2 text-sm border border-border-main rounded-lg bg-bg-main text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
            
            <div className="border-t border-border-main pt-3 mt-3">
              <div className="text-xs text-text-secondary mb-2">修改用户名（可选）</div>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="新用户名"
                className="w-full px-3 py-2 text-sm border border-border-main rounded-lg bg-bg-main text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="border-t border-border-main pt-3 mt-3">
              <div className="text-xs text-text-secondary mb-2">修改密码（可选）</div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新密码"
                  className="px-3 py-2 text-sm border border-border-main rounded-lg bg-bg-main text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  minLength={6}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="确认新密码"
                  className="px-3 py-2 text-sm border border-border-main rounded-lg bg-bg-main text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  minLength={6}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm mt-4"
            >
              {saving ? '保存中...' : '保存修改'}
            </button>
          </form>
        </section>

        {/* 危险区域 */}
        <section className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-5">
          <h3 className="text-base font-medium text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            危险区域
          </h3>
          
          <div className="space-y-3">
            <button
              onClick={() => openDeleteConfirm('navigation')}
              className="w-full px-4 py-2.5 bg-white dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              删除所有导航（分类和链接）
            </button>
            <button
              onClick={() => openDeleteConfirm('notes')}
              className="w-full px-4 py-2.5 bg-white dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              删除所有笔记
            </button>
            <button
              onClick={() => openDeleteConfirm('clipboard')}
              className="w-full px-4 py-2.5 bg-white dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              删除所有剪贴板
            </button>
          </div>
        </section>

        {/* 退出登录 */}
        <button
          onClick={logout}
          className="w-full px-4 py-2.5 bg-bg-card border border-red-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          退出登录
        </button>

      </div>
      
      {/* 删除确认弹窗 */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        confirmText="确认删除"
        type="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, type: null, title: '', message: '' })}
      />
    </div>
  )
}
