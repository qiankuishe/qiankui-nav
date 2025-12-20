import { getAuthToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5173'

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

// 公开获取网站基本设置（不需要认证，用于登录页面）
export async function getPublicSettings(): Promise<{ website_name: string; logo_url: string }> {
  const response = await fetch(`${API_BASE}/api/settings/public`, {
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    // 如果公开端点不存在，返回默认值
    return { website_name: 'qiankui导航', logo_url: '' }
  }

  return response.json()
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
  export_size: number
}

// Get user settings
export async function getUserSettings(): Promise<UserSettings> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const response = await fetch(`${API_BASE}/api/settings`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get settings')
  }

  return response.json()
}

// Update user settings
export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const response = await fetch(`${API_BASE}/api/settings`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update settings')
  }

  return response.json()
}

// Export user data
export async function exportUserData(): Promise<ExportData> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const response = await fetch(`${API_BASE}/api/settings/export`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to export data')
  }

  return response.json()
}

// Import user data
export async function importUserData(data: ExportData): Promise<ImportResult> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const response = await fetch(`${API_BASE}/api/settings/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to import data')
  }

  return response.json()
}

// Update user credentials
export async function updateUserCredentials(
  currentPassword: string, 
  newPassword?: string,
  newUsername?: string
): Promise<{ success: boolean; message: string; username?: string }> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const response = await fetch(`${API_BASE}/api/settings/credentials`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      currentPassword,
      newPassword,
      newUsername
    })
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update credentials')
  }
  
  return data
}

// Get export statistics
export async function getExportStats(): Promise<ExportStats> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const response = await fetch(`${API_BASE}/api/settings/export/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get export stats')
  }

  return response.json()
}

// Download export data as file
export async function downloadExportData(): Promise<void> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const response = await fetch(`${API_BASE}/api/settings/export`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to export data')
  }

  // Create download
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `navigation-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}