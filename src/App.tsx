import { useEffect, useMemo, useState } from 'react'
import { FiSettings } from 'react-icons/fi'
import { loginAdmin } from './api/admin-auth'
import { createWhiteboardInstance } from './api/whiteboard'
import { ApiSettingsDialog } from './components/ApiSettingsDialog'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { isAdminAuthenticated, setAdminAuthenticated } from './features/admin-auth'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminInstancesPage } from './pages/admin/AdminInstancesPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminMapsPage } from './pages/admin/AdminMapsPage'
import { AdminPasswordPage } from './pages/admin/AdminPasswordPage'
import { HomePage } from './pages/HomePage'
import { MapInstancePage } from './pages/MapInstancePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { buildMapInstancePath, resolveRoute, ROUTES } from './router/routes'
import { useTranslation } from 'react-i18next'

const navigateTo = (path: string) => {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function App() {
  const { t } = useTranslation()
  const [pathname, setPathname] = useState(window.location.pathname)
  const [search, setSearch] = useState(window.location.search)
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => isAdminAuthenticated())
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const shouldShowSettingsEntry = true

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname)
      setSearch(window.location.search)
    }
    window.addEventListener('popstate', onPopState)

    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!shouldShowSettingsEntry) {
      return
    }

    const onShortcut = (event: KeyboardEvent) => {
      if (event.key !== ',' || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) {
        return
      }

      event.preventDefault()
      setSettingsOpen(true)
    }

    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [shouldShowSettingsEntry])

  useEffect(() => {
    if (!shouldShowSettingsEntry) {
      document.documentElement.style.setProperty('--desktop-titlebar-safe-top', '0px')
      return
    }

    const platform = window.desktopApp?.platform
    const safeTop = platform === 'darwin' ? 48 : platform === 'win32' ? 10 : 0
    document.documentElement.style.setProperty('--desktop-titlebar-safe-top', `${safeTop}px`)

    return () => {
      document.documentElement.style.setProperty('--desktop-titlebar-safe-top', '0px')
    }
  }, [shouldShowSettingsEntry])

  const route = useMemo(() => resolveRoute(pathname), [pathname])
  const currentPathWithSearch = useMemo(() => `${pathname}${search}`, [pathname, search])
  const isAdminProtectedRoute =
    route.name === 'admin-dashboard' ||
    route.name === 'admin-maps' ||
    route.name === 'admin-instances' ||
    route.name === 'admin-password'
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
    const shouldLockBodyScroll =
      route.name === 'admin-dashboard' ||
      route.name === 'admin-maps' ||
      route.name === 'admin-instances' ||
      route.name === 'admin-password'
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

  const handleCreateInstance = async (mapId: number) => {
    const instance = await createWhiteboardInstance(mapId)
    navigateTo(buildMapInstancePath(instance.id))
  }

  const handleJoinInstance = async (instanceId: string) => {
    navigateTo(buildMapInstancePath(instanceId.trim()))
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
    content = <HomePage onCreateInstance={handleCreateInstance} onJoinInstance={handleJoinInstance} />
  } else if (route.name === 'map-instance') {
    content = <MapInstancePage instanceId={route.instanceId} onBackHome={() => navigateTo(ROUTES.home)} />
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
  } else if (route.name === 'admin-instances') {
    content = adminLoggedIn ? <AdminInstancesPage onNavigate={navigateTo} onLogout={handleAdminLogout} /> : null
  } else if (route.name === 'admin-password') {
    content = adminLoggedIn ? <AdminPasswordPage onNavigate={navigateTo} onLogout={handleAdminLogout} /> : null
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
      {shouldShowSettingsEntry && (
        <div
          className="fixed right-4 z-40 flex items-center gap-2 rounded-full border border-emerald-200/35 bg-emerald-950/75 px-2 py-1.5 text-emerald-100 shadow-[0_10px_24px_rgba(0,0,0,0.3)] backdrop-blur"
          style={{ top: 'calc(0.75rem + var(--desktop-titlebar-safe-top))' }}
        >
          <button
            type="button"
            aria-label={t('settings.title')}
            title={`${t('settings.title')} (Cmd/Ctrl + ,)`}
            onClick={() => setSettingsOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200/35 bg-emerald-900/75 text-emerald-50 transition hover:bg-emerald-800/80"
          >
            <FiSettings />
          </button>
          <LanguageSwitcher inline />
        </div>
      )}
      {content}
      {settingsOpen && <ApiSettingsDialog onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

export default App
