import api from './api'

export interface UserSettings {
  website_name: string
  logo_url: string
  theme: 'light' | 'dark' | 'auto'
  sidebar_width: number
  language: string
  search_engine: 'google' | 'bing' | 'baidu'
  items_per_page: number
  show_icons: boolean
  auto_save: boolean
}

export interface ExportData {
  version: string
  exportDate: string
  user: {
    username: string
    settings: UserSettings
  }
  categories: Array<{
    id: string
    name: string
    order: number
    links: Array<{
      id: string
      title: string
      url: string
      icon_url?: string
      order: number
    }>
  }>
  notes: Array<{
    id: string
    title: string
    content: string
    created_at: string
    updated_at: string
  }>
  clipboard_items: Array<{
    id: string
    type: 'text' | 'code' | 'image'
    title: string
    content: string
    metadata?: any
    created_at: string
    updated_at: string
  }>
}

export interface ImportResult {
  success: boolean
  message: string
  imported: {
    categories: number
    links: number
    notes: number
    clipboard_items: number
  }
  errors: string[]
}

export interface ExportStats {
  categories: number
  links: number
  notes: number
  clipboard_items: number
  export_size?: number
}

// 公开获取网站基本设置（不需要认证，用于登录页面）
export async function getPublicSettings(): Promise<{ website_name: string; logo_url: string }> {
  try {
    const response = await api.get('/api/settings/public')
    return response.data
  } catch {
    return { website_name: 'qiankui导航', logo_url: '' }
  }
}

// Get user settings
export async function getUserSettings(): Promise<UserSettings> {
  const response = await api.get('/api/settings')
  return response.data?.data || response.data
}

// Update user settings
export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const response = await api.put('/api/settings', settings)
  return response.data?.data || response.data
}

// Export user data
export async function exportUserData(): Promise<ExportData> {
  const response = await api.get('/api/settings/export')
  return response.data?.data || response.data
}

// Import user data
export async function importUserData(data: ExportData): Promise<ImportResult> {
  const response = await api.post('/api/settings/import', data)
  return response.data
}

// Update user credentials
export async function updateUserCredentials(
  currentPassword: string,
  newPassword?: string,
  newUsername?: string
): Promise<{ success: boolean; message: string; username?: string }> {
  const response = await api.put('/api/settings/credentials', {
    currentPassword,
    newPassword,
    newUsername,
  })
  return response.data
}

// Get export statistics
export async function getExportStats(): Promise<ExportStats> {
  const response = await api.get('/api/settings/export/stats')
  return response.data?.data || response.data
}

// Download export data as file
export async function downloadExportData(): Promise<void> {
  const response = await api.get('/api/settings/export', {
    responseType: 'blob',
  })

  const blob = new Blob([JSON.stringify(response.data)], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `navigation-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
