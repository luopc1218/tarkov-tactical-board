import { useEffect, useMemo, useState } from 'react'
import { loginAdmin } from './api/admin-auth'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { isAdminAuthenticated, setAdminAuthenticated } from './features/admin-auth'
import { createMapInstance } from './features/map-instance'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminMapsPage } from './pages/admin/AdminMapsPage'
import { HomePage } from './pages/HomePage'
import { MapInstancePage } from './pages/MapInstancePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { buildMapInstancePath, resolveRoute, ROUTES } from './router/routes'
import type { MapInstance } from './types/map-instance'

const navigateTo = (path: string) => {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function App() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const [search, setSearch] = useState(window.location.search)
  const [instances, setInstances] = useState<Record<string, MapInstance>>({})
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => isAdminAuthenticated())
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null)

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname)
      setSearch(window.location.search)
    }
    window.addEventListener('popstate', onPopState)

    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const route = useMemo(() => resolveRoute(pathname), [pathname])
  const currentPathWithSearch = useMemo(() => `${pathname}${search}`, [pathname, search])
  const isAdminProtectedRoute = route.name === 'admin-dashboard' || route.name === 'admin-maps'
  const showFloatingLanguageSwitcher = !isAdminProtectedRoute

  useEffect(() => {
    if (!isAdminProtectedRoute || adminLoggedIn) {
      return
    }

    if (pathname === ROUTES.adminLogin) {
      return
    }

    navigateTo(`${ROUTES.adminLogin}?redirect=${encodeURIComponent(currentPathWithSearch)}`)
  }, [adminLoggedIn, currentPathWithSearch, isAdminProtectedRoute, pathname])

  useEffect(() => {
    const shouldLockBodyScroll = route.name === 'admin-dashboard' || route.name === 'admin-maps'
    document.body.style.overflow = shouldLockBodyScroll ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [route.name])

  useEffect(() => {
    if (route.name !== 'admin-login' || !adminLoggedIn) {
      return
    }

    navigateTo(ROUTES.adminDashboard)
  }, [adminLoggedIn, route.name])

  const handleCreateInstance = (mapId: string) => {
    const instance = createMapInstance(mapId)

    setInstances((prev) => ({
      ...prev,
      [instance.id]: instance,
    }))
    navigateTo(buildMapInstancePath(instance.id))
  }

  const handleAdminLogin = async (payload: { username: string; password: string }) => {
    try {
      setAdminLoginLoading(true)
      setAdminLoginError(null)

      const response = await loginAdmin(payload)
      setAdminAuthenticated(true, {
        tokenType: response.tokenType || 'Bearer',
        accessToken: response.accessToken,
        expireSeconds: response.expireSeconds,
      })
      setAdminLoggedIn(true)

      const redirect = new URLSearchParams(search).get('redirect')
      const safeRedirect = redirect && redirect.startsWith('/admin') ? redirect : ROUTES.adminDashboard
      navigateTo(safeRedirect)
    } catch (error) {
      setAdminLoginError(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setAdminLoginLoading(false)
    }
  }

  const handleAdminLogout = () => {
    setAdminAuthenticated(false)
    setAdminLoggedIn(false)
    setAdminLoginError(null)
    navigateTo(ROUTES.adminLogin)
  }

  let content: React.ReactNode = null

  if (route.name === 'home') {
    content = <HomePage onCreateInstance={handleCreateInstance} />
  } else if (route.name === 'map-instance') {
    content = (
      <MapInstancePage
        instance={instances[route.instanceId] ?? null}
        onBackHome={() => navigateTo(ROUTES.home)}
      />
    )
  } else if (route.name === 'admin-login') {
    content = (
      <AdminLoginPage
        onLogin={handleAdminLogin}
        loading={adminLoginLoading}
        errorMessage={adminLoginError}
      />
    )
  } else if (route.name === 'admin-dashboard') {
    content = adminLoggedIn ? (
      <AdminDashboardPage onNavigate={navigateTo} onLogout={handleAdminLogout} />
    ) : null
  } else if (route.name === 'admin-maps') {
    content = adminLoggedIn ? <AdminMapsPage onNavigate={navigateTo} onLogout={handleAdminLogout} /> : null
  } else if (route.name === 'admin-not-found') {
    content = (
      <NotFoundPage
        pathname={pathname}
        onBackHome={() => navigateTo(ROUTES.adminDashboard)}
        onBackPrevious={() => window.history.back()}
      />
    )
  } else {
    content = (
      <NotFoundPage
        pathname={pathname}
        onBackHome={() => navigateTo(ROUTES.home)}
        onBackPrevious={() => window.history.back()}
      />
    )
  }

  return (
    <>
      {showFloatingLanguageSwitcher && <LanguageSwitcher />}
      {content}
    </>
  )
}

export default App
