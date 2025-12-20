import { getAuthToken } from './auth'

export interface ClipboardItem {
  id: string
  userId: string
  type: 'text' | 'code' | 'image'
  title: string
  content: string
  metadata?: {
    language?: string
    mimeType?: string
    size?: number
  }
  createdAt: string
  updatedAt: string
}

export interface CreateClipboardItemData {
  type: 'text' | 'code' | 'image'
  title: string
  content: string
  metadata?: {
    language?: string
    mimeType?: string
    size?: number
  }
}

export interface UpdateClipboardItemData {
  title?: string
  content?: string
  metadata?: {
    language?: string
    mimeType?: string
    size?: number
  }
}

export interface ClipboardStats {
  totalItems: number
  textItems: number
  codeItems: number
  imageItems: number
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token found')
  }

  const url = `${API_BASE}/api/clipboard${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

export async function createClipboardItem(data: CreateClipboardItemData): Promise<ClipboardItem> {
  return apiRequest<ClipboardItem>('/items', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getClipboardItems(type?: 'text' | 'code' | 'image'): Promise<ClipboardItem[]> {
  const params = type ? `?type=${type}` : ''
  return apiRequest<ClipboardItem[]>(`/items${params}`)
}

export async function getClipboardItem(id: string): Promise<ClipboardItem> {
  return apiRequest<ClipboardItem>(`/items/${id}`)
}

export async function updateClipboardItem(id: string, data: UpdateClipboardItemData): Promise<ClipboardItem> {
  return apiRequest<ClipboardItem>(`/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteClipboardItem(id: string): Promise<void> {
  return apiRequest<void>(`/items/${id}`, {
    method: 'DELETE',
  })
}

export async function searchClipboardItems(query: string, type?: 'text' | 'code' | 'image'): Promise<ClipboardItem[]> {
  const params = new URLSearchParams({ q: query })
  if (type) {
    params.append('type', type)
  }
  return apiRequest<ClipboardItem[]>(`/search?${params}`)
}

export async function getClipboardStats(): Promise<ClipboardStats> {
  return apiRequest<ClipboardStats>('/stats')
}

// Utility functions for clipboard operations
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getLanguageDisplayName(language: string): string {
  const languageNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    html: 'HTML',
    css: 'CSS',
    sql: 'SQL',
    json: 'JSON',
    xml: 'XML',
    yaml: 'YAML',
    markdown: 'Markdown',
    bash: 'Bash',
    powershell: 'PowerShell',
    php: 'PHP',
    ruby: 'Ruby',
    go: 'Go',
    rust: 'Rust',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    swift: 'Swift',
    kotlin: 'Kotlin',
    dart: 'Dart'
  }
  
  return languageNames[language.toLowerCase()] || language
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: '请选择图片文件' }
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: '图片大小不能超过 5MB' }
  }

  // Check supported formats
  const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!supportedTypes.includes(file.type)) {
    return { valid: false, error: '支持的图片格式：JPEG, PNG, GIF, WebP' }
  }

  return { valid: true }
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}