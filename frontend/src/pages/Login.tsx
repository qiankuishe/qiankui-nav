import React, { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'
import { getPublicSettings } from '../utils/settingsApi'
import PublicStickers, { MobileStickerList } from '../components/PublicStickers'

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [lockCountdown, setLockCountdown] = useState<number | null>(null)
  const [lockType, setLockType] = useState<'ip' | 'username' | null>(null)
  const [siteName, setSiteName] = useState('qiankui导航')
  const [logoUrl, setLogoUrl] = useState('')
  const [showMobileStickers, setShowMobileStickers] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadSiteSettings()
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // 倒计时逻辑
  useEffect(() => {
    if (lockCountdown && lockCountdown > 0) {
      countdownRef.current = setInterval(() => {
        setLockCountdown(prev => {
          if (prev && prev > 1) return prev - 1
          // 倒计时结束
          if (countdownRef.current) clearInterval(countdownRef.current)
          setLockType(null)
          return null
        })
      }, 1000)
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [lockCountdown])

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
    const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement('link')
    link.type = 'image/x-icon'
    link.rel = 'icon'
    link.href = logoUrl || '/logo.png'
    document.head.appendChild(link)
  }

  if (isAuthenticated) return <Navigate to="/" replace />

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs} 秒`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.username.trim() || !formData.password) {
      setError('请输入用户名和密码')
      return
    }

    // 如果正在锁定中，不允许提交
    if (lockCountdown && lockCountdown > 0) {
      return
    }

    setIsSubmitting(true)
    setError('')
    setAttemptsRemaining(null)

    try {
      const response = await login({
        username: formData.username.trim(),
        password: formData.password,
      })

      if (!response.success) {
        setError(response.error || '登录失败')
        
        // 处理锁定状态
        if (response.remainingSeconds) {
          setLockCountdown(response.remainingSeconds)
          setLockType(response.lockType || null)
        } else if (response.attemptsRemaining !== undefined) {
          setAttemptsRemaining(response.attemptsRemaining)
        }
      }
    } catch (error) {
      setError('发生错误，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLocked = lockCountdown && lockCountdown > 0

  // 移动端便签列表
  if (showMobileStickers) {
    return <MobileStickerList onClose={() => setShowMobileStickers(false)} />
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 relative"
      style={{ background: 'linear-gradient(135deg, var(--color-bg-main) 0%, var(--color-bg-card) 100%)' }}
    >
      {/* 公开便签 */}
      <PublicStickers onShowMobileList={() => setShowMobileStickers(true)} />

      <div className="w-full max-w-[420px] bg-bg-card rounded-3xl border border-border-main shadow-xl overflow-hidden relative z-10">
        {/* Header */}
        <div 
          className="flex items-center gap-4 px-9 pt-8 pb-6"
          style={{ background: 'linear-gradient(135deg, rgba(166, 124, 82, 0.1) 0%, transparent 100%)' }}
        >
          <img src={logoUrl || '/logo.png'} alt="Logo" className="h-14 w-14 rounded-xl object-contain flex-shrink-0 shadow-md" />
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-primary leading-tight tracking-wide">{siteName}</h1>
            <p className="text-sm text-text-secondary mt-1">个人导航管理系统</p>
          </div>
        </div>

        {/* Login Form */}
        <form className="px-9 pt-8 pb-10 space-y-6" onSubmit={handleSubmit}>
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">用户名</label>
            <input
              name="username"
              type="text"
              required
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-4 py-3.5 border border-border-main rounded-xl bg-bg-main text-text-main placeholder-text-secondary/60 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-all text-[15px] disabled:opacity-50"
              placeholder="请输入用户名"
              autoComplete="username"
              disabled={isSubmitting || isLocked}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">密码</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3.5 pr-12 border border-border-main rounded-xl bg-bg-main text-text-main placeholder-text-secondary/60 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-all text-[15px] disabled:opacity-50"
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={isSubmitting || isLocked}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary/60 hover:text-primary transition-colors"
                disabled={isSubmitting || isLocked}
              >
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Error & Status */}
          {(error || isLocked) && (
            <div className={`rounded-xl p-3 ${isLocked ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isLocked ? 'text-orange-500' : 'text-red-500'}`} />
                <div className="flex-1">
                  <p className={`text-sm ${isLocked ? 'text-orange-700' : 'text-red-600'}`}>
                    {isLocked ? (
                      <>
                        {lockType === 'ip' ? '当前 IP 请求过于频繁' : '账号已被临时锁定'}
                        <span className="font-medium ml-1">请等待 {formatCountdown(lockCountdown!)}</span>
                      </>
                    ) : error}
                  </p>
                  {!isLocked && attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <p className="text-xs text-text-secondary mt-1">
                      还剩 <span className="font-medium text-orange-600">{attemptsRemaining}</span> 次尝试机会
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || isLocked}
            className="w-full py-3.5 px-6 mt-2 rounded-xl text-base font-semibold text-white bg-gradient-to-br from-primary to-primary-hover hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all shadow-md"
            style={{ boxShadow: '0 4px 12px rgba(166, 124, 82, 0.3)' }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
                登录中...
              </span>
            ) : isLocked ? (
              `请等待 ${formatCountdown(lockCountdown!)}`
            ) : (
              '登 录'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
