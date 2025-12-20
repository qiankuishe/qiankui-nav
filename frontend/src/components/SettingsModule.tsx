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
} from '@heroicons/react/24/outline'
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

export default function SettingsModule() {
  const { logout, user } = useAuth()
  const [exportStats, setExportStats] = useState<ExportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
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

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 2000)
  }

  const handleSiteSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!websiteName.trim()) {
      showMessage('error', '网站名称不能为空')
      return
    }
    try {
      setSavingSite(true)
      await updateUserSettings({
        website_name: websiteName.trim(),
        logo_url: logoUrl
      })
      showMessage('success', '保存成功')
      // 触发页面刷新以更新侧边栏
      window.dispatchEvent(new CustomEvent('siteSettingsUpdated'))
    } catch (error: any) {
      showMessage('error', error.message || '保存失败')
    } finally {
      setSavingSite(false)
    }
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      showMessage('error', '请选择图片文件')
      return
    }
    
    // 检查文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', '图片大小不能超过 5MB')
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
      showMessage('success', '导出成功')
    } catch (error) {
      showMessage('error', '导出失败')
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data: ExportData = JSON.parse(text)
      const result = await importUserData(data)
      showMessage(result.success ? 'success' : 'error', result.message)
      if (result.success) {
        loadData()
      }
    } catch (error) {
      showMessage('error', '导入失败')
    }
  }

  const handleAccountSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentPassword) {
      showMessage('error', '请输入当前密码')
      return
    }
    
    // 检查是否有修改
    if (!newUsername.trim() && !newPassword) {
      showMessage('error', '请输入新用户名或新密码')
      return
    }
    
    // 如果修改密码，检查确认密码
    if (newPassword && newPassword !== confirmPassword) {
      showMessage('error', '两次密码不一致')
      return
    }
    
    if (newPassword && newPassword.length < 6) {
      showMessage('error', '新密码至少6位')
      return
    }
    
    try {
      setSaving(true)
      await updateUserCredentials(
        currentPassword, 
        newPassword || undefined, 
        newUsername.trim() || undefined
      )
      showMessage('success', '修改成功，请重新登录')
      setCurrentPassword('')
      setNewUsername('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => logout(), 1500)
    } catch (error: any) {
      showMessage('error', error.message || '修改失败')
    } finally {
      setSaving(false)
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
      {/* 消息提示 - 顶部居中 */}
      {message && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${
          message.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {message.text}
        </div>
      )}

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

      </div>
      
      {/* 退出登录 - 独立于 space-y 容器 */}
      <div className="max-w-2xl mx-auto px-5 pb-5 pt-[31px]">
        <button
          onClick={logout}
          className="w-full px-4 py-2.5 bg-bg-card border border-red-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </div>
  )
}
