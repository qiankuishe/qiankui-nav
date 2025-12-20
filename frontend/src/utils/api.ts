import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5173'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 不要在登录请求失败时重定向（包括401和429）
    const isLoginRequest = error.config?.url?.includes('/api/auth/login')
    
    if (error.response?.status === 401 && !isLoginRequest) {
      // Token expired or invalid (not login failure)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthResponse {
  success: boolean
  user?: {
    id: string
    username: string
    settings: any
  }
  token?: string
  error?: string
  lockoutInfo?: {
    isLocked: boolean
    lockedUntil?: string
    attempts: number
  }
}

export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const response = await api.post('/api/auth/login', credentials)
      return response.data
    } catch (error: any) {
      // 登录失败时返回后端的错误信息
      if (error.response?.data) {
        return error.response.data
      }
      return {
        success: false,
        error: '登录请求失败'
      }
    }
  },

  register: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/register', credentials)
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout')
  },

  validateSession: async (): Promise<AuthResponse> => {
    const response = await api.get('/api/auth/validate')
    return response.data
  },

  refreshToken: async (token: string): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/refresh', { token })
    return response.data
  },
}

// Navigation API
export interface Category {
  id: string
  userId: string
  name: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface Link {
  id: string
  userId: string
  categoryId: string
  title: string
  url: string
  description?: string
  iconUrl?: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface CategoryWithLinks extends Category {
  links: Link[]
}

export interface NavigationData {
  categories: CategoryWithLinks[]
  totalCategories: number
  totalLinks: number
}

export interface NavigationResponse {
  success: boolean
  data?: NavigationData
  error?: string
}

export const navigationAPI = {
  getNavigationData: async (): Promise<NavigationResponse> => {
    const response = await api.get('/api/navigation')
    return response.data
  },

  createCategory: async (name: string, order?: number): Promise<{ success: boolean; data?: Category; error?: string }> => {
    const response = await api.post('/api/navigation/categories', { name, order })
    return response.data
  },

  updateCategory: async (categoryId: string, updates: { name?: string; order?: number }): Promise<{ success: boolean; data?: Category; error?: string }> => {
    const response = await api.put(`/api/navigation/categories/${categoryId}`, updates)
    return response.data
  },

  deleteCategory: async (categoryId: string): Promise<{ success: boolean; error?: string }> => {
    const response = await api.delete(`/api/navigation/categories/${categoryId}`)
    return response.data
  },

  reorderCategories: async (categoryIds: string[]): Promise<{ success: boolean; error?: string }> => {
    const response = await api.put('/api/navigation/categories/reorder', { categoryIds })
    return response.data
  },

  createLink: async (data: { categoryId: string; title: string; url: string; description?: string; order?: number; iconUrl?: string }): Promise<{ success: boolean; data?: Link; error?: string }> => {
    const response = await api.post('/api/navigation/links', data)
    return response.data
  },

  updateLink: async (linkId: string, updates: { title?: string; url?: string; description?: string; order?: number; iconUrl?: string }): Promise<{ success: boolean; data?: Link; error?: string }> => {
    const response = await api.put(`/api/navigation/links/${linkId}`, updates)
    return response.data
  },

  deleteLink: async (linkId: string): Promise<{ success: boolean; error?: string }> => {
    const response = await api.delete(`/api/navigation/links/${linkId}`)
    return response.data
  },

  moveLink: async (linkId: string, targetCategoryId: string, newOrder: number): Promise<{ success: boolean; data?: Link; error?: string }> => {
    const response = await api.put('/api/navigation/links/move', { linkId, targetCategoryId, newOrder })
    return response.data
  },

  reorderLinks: async (categoryId: string, linkIds: string[]): Promise<{ success: boolean; error?: string }> => {
    const response = await api.put('/api/navigation/links/reorder', { categoryId, linkIds })
    return response.data
  },

  searchLinks: async (query: string): Promise<{ success: boolean; data?: Link[]; error?: string }> => {
    const response = await api.get(`/api/navigation/search?q=${encodeURIComponent(query)}`)
    return response.data
  },
}

// Convenience functions for easier use
export const getCategories = async (): Promise<CategoryWithLinks[]> => {
  const response = await navigationAPI.getNavigationData()
  if (response.success && response.data) {
    return response.data.categories
  }
  throw new Error(response.error || 'Failed to fetch categories')
}

export const updateCategoryOrder = async (categoryIds: string[]): Promise<void> => {
  const response = await navigationAPI.reorderCategories(categoryIds)
  if (!response.success) {
    throw new Error(response.error || 'Failed to update category order')
  }
}

export const updateLinkOrder = async (categoryId: string, linkIds: string[]): Promise<void> => {
  const response = await navigationAPI.reorderLinks(categoryId, linkIds)
  if (!response.success) {
    throw new Error(response.error || 'Failed to update link order')
  }
}

export const moveLinkToCategory = async (linkId: string, targetCategoryId: string): Promise<void> => {
  // Get the target category to determine the new order (append to end)
  const categories = await getCategories()
  const targetCategory = categories.find(cat => cat.id === targetCategoryId)
  const newOrder = targetCategory ? targetCategory.links.length : 0
  
  const response = await navigationAPI.moveLink(linkId, targetCategoryId, newOrder)
  if (!response.success) {
    throw new Error(response.error || 'Failed to move link')
  }
}

export default api