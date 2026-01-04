import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Home from './pages/Home'

const router = createBrowserRouter(
  [
    { path: '/login', element: <Login /> },
    { path: '/', element: <ProtectedRoute><Home /></ProtectedRoute> },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  }
)

function AppContent() {
  // 初始化主题配色
  useEffect(() => {
    const savedTheme = localStorage.getItem('colorTheme') || 'warm-brown'
    if (savedTheme !== 'warm-brown') {
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

  return (
    <div className="min-h-screen bg-bg-main">
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App