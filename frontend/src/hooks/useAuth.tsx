import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI, type AuthResponse, type LoginCredentials } from '../utils/api'

interface User {
  id: string
  username: string
  settings: any
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<AuthResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) {
          setIsLoading(false)
          return
        }

        const response = await authAPI.validateSession()
        if (response.success && response.user) {
          setUser(response.user)
        } else {
          // Invalid session, clear storage
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_info')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_info')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await authAPI.login(credentials)
    
    if (response.success && response.user && response.token) {
      setUser(response.user)
      localStorage.setItem('auth_token', response.token)
      localStorage.setItem('user_info', JSON.stringify(response.user))
    }
    
    return response
  }

  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      setUser(null)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}