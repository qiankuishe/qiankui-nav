/**
 * Frontend System Check Utilities
 * 
 * These utilities help verify that the frontend is properly configured
 * and can communicate with the backend API.
 */

export interface SystemCheckResult {
  component: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: any
}

export class SystemChecker {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl
  }

  async checkBackendConnection(): Promise<SystemCheckResult> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      
      if (response.ok) {
        return {
          component: 'Backend Connection',
          status: 'success',
          message: 'Backend server is responding'
        }
      } else {
        return {
          component: 'Backend Connection',
          status: 'error',
          message: `Backend returned status ${response.status}`
        }
      }
    } catch (error) {
      return {
        component: 'Backend Connection',
        status: 'error',
        message: 'Cannot connect to backend server',
        details: error
      }
    }
  }

  async checkAuthenticationFlow(): Promise<SystemCheckResult> {
    try {
      // Test registration endpoint
      const testUsername = `test_${Date.now()}`
      const registerResponse = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: testUsername,
          password: 'testpass123'
        })
      })

      if (registerResponse.ok) {
        // Test login endpoint
        const loginResponse = await fetch(`${this.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: testUsername,
            password: 'testpass123'
          })
        })

        if (loginResponse.ok) {
          return {
            component: 'Authentication',
            status: 'success',
            message: 'Authentication flow is working'
          }
        } else {
          return {
            component: 'Authentication',
            status: 'error',
            message: 'Login endpoint failed'
          }
        }
      } else {
        return {
          component: 'Authentication',
          status: 'error',
          message: 'Registration endpoint failed'
        }
      }
    } catch (error) {
      return {
        component: 'Authentication',
        status: 'error',
        message: 'Authentication flow check failed',
        details: error
      }
    }
  }

  checkLocalStorage(): SystemCheckResult {
    try {
      const testKey = 'system_check_test'
      const testValue = 'test_value'
      
      localStorage.setItem(testKey, testValue)
      const retrieved = localStorage.getItem(testKey)
      localStorage.removeItem(testKey)
      
      if (retrieved === testValue) {
        return {
          component: 'Local Storage',
          status: 'success',
          message: 'Local storage is working'
        }
      } else {
        return {
          component: 'Local Storage',
          status: 'error',
          message: 'Local storage read/write failed'
        }
      }
    } catch (error) {
      return {
        component: 'Local Storage',
        status: 'error',
        message: 'Local storage is not available',
        details: error
      }
    }
  }

  checkClipboardAPI(): SystemCheckResult {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return {
        component: 'Clipboard API',
        status: 'success',
        message: 'Clipboard API is available'
      }
    } else {
      return {
        component: 'Clipboard API',
        status: 'warning',
        message: 'Clipboard API not available (HTTPS required)'
      }
    }
  }

  checkDragAndDropAPI(): SystemCheckResult {
    const testElement = document.createElement('div')
    
    if ('draggable' in testElement && 'ondragstart' in testElement) {
      return {
        component: 'Drag & Drop API',
        status: 'success',
        message: 'Drag and drop API is available'
      }
    } else {
      return {
        component: 'Drag & Drop API',
        status: 'error',
        message: 'Drag and drop API not supported'
      }
    }
  }

  async runAllChecks(): Promise<SystemCheckResult[]> {
    const results: SystemCheckResult[] = []

    // Run synchronous checks
    results.push(this.checkLocalStorage())
    results.push(this.checkClipboardAPI())
    results.push(this.checkDragAndDropAPI())

    // Run asynchronous checks
    try {
      const backendCheck = await this.checkBackendConnection()
      results.push(backendCheck)

      if (backendCheck.status === 'success') {
        const authCheck = await this.checkAuthenticationFlow()
        results.push(authCheck)
      }
    } catch (error) {
      results.push({
        component: 'System Check',
        status: 'error',
        message: 'Failed to complete all checks',
        details: error
      })
    }

    return results
  }
}

export function formatSystemCheckResults(results: SystemCheckResult[]): string {
  let output = '🔍 System Check Results:\n\n'
  
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : 
                 result.status === 'warning' ? '⚠️' : '❌'
    
    output += `${icon} ${result.component}: ${result.message}\n`
    
    if (result.details && import.meta.env.DEV) {
      output += `   Details: ${JSON.stringify(result.details, null, 2)}\n`
    }
  })

  const successCount = results.filter(r => r.status === 'success').length
  const totalCount = results.length
  
  output += `\n📊 Summary: ${successCount}/${totalCount} checks passed`
  
  return output
}