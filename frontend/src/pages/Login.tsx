import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'
import { getPublicSettings } from '../utils/settingsApi'

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [siteName, setSiteName] = useState('qiankui导航')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    loadSiteSettings()
  }, [])

  const loadSiteSettings = async () => {
    try {
      const settings = await getPublicSettings()
      setSiteName(settings.website_name || 'qiankui导航')
      setLogoUrl(settings.logo_url || '')
      document.title = settings.website_name || 'qiankui导航'
      updateFavicon(settings.logo_url || '')
    } catch (error) {
      console.error('Failed to load site settings:', error)
    }
  }

  const updateFavicon = (logoUrl: string) => {
    const link =
      (document.querySelector("link[rel*='icon']") as HTMLLinkElement) ||
      document.createElement('link')
    link.type = 'image/x-icon'
    link.rel = 'icon'
    link.href = logoUrl || '/logo.png'
    document.head.appendChild(link)
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.username.trim() || !formData.password) {
      setError('请输入用户名和密码')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const response = await login({
        username: formData.username.trim(),
        password: formData.password,
      })

      if (!response.success) {
        setError(response.error || '登录失败')
      }
    } catch (error) {
      setError('发生错误，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4"
      style={{ background: 'linear-gradient(135deg, var(--color-bg-main) 0%, var(--color-bg-card) 100%)' }}
    >
      <div className="w-full max-w-[420px] bg-bg-card rounded-3xl border border-border-main shadow-xl overflow-hidden">
        {/* Header - Logo和标题横向排列，带渐变背景 */}
        <div 
          className="flex items-center gap-4 px-9 pt-8 pb-6"
          style={{ background: 'linear-gradient(135deg, rgba(166, 124, 82, 0.1) 0%, transparent 100%)' }}
        >
          <img
            src={logoUrl || '/logo.png'}
            alt="Logo"
            className="h-14 w-14 rounded-xl object-contain flex-shrink-0 shadow-md"
          />
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-primary leading-tight tracking-wide">{siteName}</h1>
            <p className="text-sm text-text-secondary mt-1">个人导航管理系统</p>
          </div>
        </div>

        {/* Login Form */}
        <form className="px-9 pt-8 pb-10 space-y-6" onSubmit={handleSubmit}>
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              用户名
            </label>
            <input
              name="username"
              type="text"
              required
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-4 py-3.5 border border-border-main rounded-xl bg-bg-main text-text-main placeholder-text-secondary/60 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-all text-[15px]"
              placeholder="请输入用户名"
              autoComplete="username"
              disabled={isSubmitting}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              密码
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3.5 pr-12 border border-border-main rounded-xl bg-bg-main text-text-main placeholder-text-secondary/60 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-all text-[15px]"
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary/60 hover:text-primary transition-colors"
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 mt-2 rounded-xl text-base font-semibold text-white bg-gradient-to-br from-primary to-primary-hover hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all shadow-md"
            style={{ boxShadow: '0 4px 12px rgba(166, 124, 82, 0.3)' }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
                登录中...
              </span>
            ) : (
              '登 录'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
