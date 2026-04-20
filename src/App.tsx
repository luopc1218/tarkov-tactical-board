import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Box, Paper } from '@mui/material'
import { loginAdmin } from './api/admin-auth'
import { createWhiteboardInstance } from './api/whiteboard'
import { ApiSettingsDialog } from './components/ApiSettingsDialog'
import { isAdminAuthenticated, setAdminAuthenticated } from './features/admin-auth'
import { saveRecentInstance } from './features/recent-instances'
import {
  addOpenSettingsListener,
  getInitialDesktopEnvironment,
  isDesktopHashRouting,
  resolveDesktopEnvironment,
} from './lib/desktop'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminMapIntelPage } from './pages/admin/AdminMapIntelPage'
import { AdminInstancesPage } from './pages/admin/AdminInstancesPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminMapsPage } from './pages/admin/AdminMapsPage'
import { AdminPasswordPage } from './pages/admin/AdminPasswordPage'
import { HomePage } from './pages/HomePage'
import { MapInstancePage } from './pages/MapInstancePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { buildMapInstancePath, resolveRoute, ROUTES } from './router/routes'

// App owns lightweight route resolution, desktop shell integration, and top-level page switching.
const normalizePathname = (value: string) => {
  const trimmed = value.replace(/\/+$/, '')
  return trimmed || ROUTES.home
}

const getWebBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL
  if (!baseUrl || baseUrl === '/' || baseUrl === './') {
    return ''
  }

  const normalizedBase = normalizePathname(baseUrl)
  return normalizedBase === ROUTES.home ? '' : normalizedBase
}

const stripBasePath = (pathname: string) => {
  const normalizedPathname = normalizePathname(pathname)
  const basePath = getWebBasePath()
  if (!basePath) {
    return normalizedPathname
  }

  if (normalizedPathname === basePath) {
    return ROUTES.home
  }

  if (normalizedPathname.startsWith(`${basePath}/`)) {
    const routePath = normalizedPathname.slice(basePath.length)
    return routePath || ROUTES.home
  }

  return normalizedPathname
}

const shouldUseHashRouting = () => {
  return window.location.protocol === 'file:' || isDesktopHashRouting()
}

const buildNavigationUrl = (path: string) => {
  if (shouldUseHashRouting()) {
    return `#${path}`
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const basePath = getWebBasePath()

  if (!basePath) {
    return normalizedPath
  }

  if (normalizedPath === ROUTES.home) {
    return `${basePath}/`
  }

  return `${basePath}${normalizedPath}`
}

const navigateTo = (path: string, options?: { replace?: boolean }) => {
  const method = options?.replace ? 'replaceState' : 'pushState'
  window.history[method](null, '', buildNavigationUrl(path))
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const getNormalizedLocation = () => {
  const { pathname, protocol, hash, search } = window.location
  const isFilePage = protocol === 'file:'
  const hashRoute = hash.startsWith('#') ? hash.slice(1) : ''
  if (shouldUseHashRouting() && hashRoute.startsWith('/')) {
    const queryIndex = hashRoute.indexOf('?')
    if (queryIndex === -1) {
      return { pathname: hashRoute, search: '' }
    }
    return {
      pathname: hashRoute.slice(0, queryIndex),
      search: hashRoute.slice(queryIndex),
    }
  }

  if (!isFilePage) {
    return { pathname: stripBasePath(pathname), search }
  }

  const normalized = pathname.replace(/\\/g, '/').toLowerCase()
  if (normalized.endsWith('/index.html')) {
    return { pathname: ROUTES.home, search: '' }
  }

  const drivePrefixedPathMatch = pathname.match(/^\/[a-zA-Z]:\/(instances|admin)(?:\/|$)/)
  if (drivePrefixedPathMatch) {
    const routePath = pathname.replace(/^\/[a-zA-Z]:/, '')
    return { pathname: routePath, search: '' }
  }

  const routeStartIndex = normalized.search(/\/(instances|admin)(\/|$)/)
  if (routeStartIndex >= 0) {
    const routePath = pathname.slice(routeStartIndex).replace(/\\/g, '/')
    return { pathname: routePath, search: '' }
  }

  return { pathname: stripBasePath(pathname), search }
}

function App() {
  const prefersReducedMotion = useReducedMotion()
  const [desktopEnvironment, setDesktopEnvironment] = useState(() => getInitialDesktopEnvironment())
  const desktopPlatform = desktopEnvironment.platform
  const isDesktopApp = desktopEnvironment.isDesktopApp
  const isWindowsDesktop = desktopPlatform === 'win32'
  const [pathname, setPathname] = useState(() => getNormalizedLocation().pathname)
  const [search, setSearch] = useState(() => getNormalizedLocation().search)
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => isAdminAuthenticated())
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const shouldShowSettingsEntry = desktopPlatform !== 'darwin' || desktopEnvironment.isTauri

  useEffect(() => {
    let mounted = true

    void resolveDesktopEnvironment().then((environment) => {
      if (mounted) {
        setDesktopEnvironment(environment)
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const location = getNormalizedLocation()
      setPathname(location.pathname)
      setSearch(location.search)
    }
    window.addEventListener('popstate', onPopState)

    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!shouldShowSettingsEntry) {
      return
    }

    const onShortcut = (event: KeyboardEvent) => {
      if (
        event.key !== ',' ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey)
      ) {
        return
      }

      event.preventDefault()
      setSettingsOpen(true)
    }

    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [shouldShowSettingsEntry])

  useEffect(() => {
    let timer: number | null = null
    const onHttpError = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>
      const message = customEvent.detail?.message?.trim()
      if (!message) {
        return
      }
      setToastMessage(message)
      if (timer !== null) {
        window.clearTimeout(timer)
      }
      timer = window.setTimeout(() => {
        setToastMessage(null)
        timer = null
      }, 3200)
    }

    window.addEventListener('http-error', onHttpError as EventListener)
    return () => {
      window.removeEventListener('http-error', onHttpError as EventListener)
      if (timer !== null) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  useEffect(() => {
    if (!shouldShowSettingsEntry) {
      document.documentElement.style.setProperty('--desktop-titlebar-safe-top', '0px')
      document.documentElement.style.setProperty('--desktop-titlebar-safe-right', '0px')
      document.documentElement.style.setProperty('--desktop-window-controls-width', '0px')
      return
    }

    const safeTop = desktopPlatform === 'darwin' ? 48 : desktopPlatform === 'win32' ? 40 : 0
    const safeRight = desktopPlatform === 'win32' ? 144 : 0
    const windowControlsWidth = desktopPlatform === 'win32' ? 138 : 0
    document.documentElement.style.setProperty('--desktop-titlebar-safe-top', `${safeTop}px`)
    document.documentElement.style.setProperty('--desktop-titlebar-safe-right', `${safeRight}px`)
    document.documentElement.style.setProperty(
      '--desktop-window-controls-width',
      `${windowControlsWidth}px`
    )

    return () => {
      document.documentElement.style.setProperty('--desktop-titlebar-safe-top', '0px')
      document.documentElement.style.setProperty('--desktop-titlebar-safe-right', '0px')
      document.documentElement.style.setProperty('--desktop-window-controls-width', '0px')
    }
  }, [desktopPlatform, shouldShowSettingsEntry])

  useEffect(() => {
    document.documentElement.setAttribute('data-platform', desktopPlatform)

    return () => {
      document.documentElement.removeAttribute('data-platform')
    }
  }, [desktopPlatform])

  useEffect(() => {
    const unsubscribe = addOpenSettingsListener(() => {
      setSettingsOpen(true)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  const route = useMemo(() => resolveRoute(pathname), [pathname])
  const currentPathWithSearch = useMemo(() => `${pathname}${search}`, [pathname, search])
  const isAdminProtectedRoute =
    route.name === 'admin-dashboard' ||
    route.name === 'admin-maps' ||
    route.name === 'admin-map-intel' ||
    route.name === 'admin-instances' ||
    route.name === 'admin-password'
  const isAdminShellRoute =
    route.name === 'admin-dashboard' ||
    route.name === 'admin-maps' ||
    route.name === 'admin-map-intel' ||
    route.name === 'admin-instances' ||
    route.name === 'admin-password'
  useEffect(() => {
    if (!isAdminProtectedRoute || adminLoggedIn) {
      return
    }

    if (pathname === ROUTES.adminLogin) {
      return
    }

    navigateTo(`${ROUTES.adminLogin}?redirect=${encodeURIComponent(currentPathWithSearch)}`, {
      replace: true,
    })
  }, [adminLoggedIn, currentPathWithSearch, isAdminProtectedRoute, pathname])

  useEffect(() => {
    const shouldLockBodyScroll =
      route.name === 'admin-dashboard' ||
      route.name === 'admin-maps' ||
      route.name === 'admin-map-intel' ||
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

    navigateTo(ROUTES.adminDashboard, { replace: true })
  }, [adminLoggedIn, route.name])

  const handleCreateInstance = async (payload: { mapId: number; mapName: string }) => {
    const instance = await createWhiteboardInstance(payload.mapId)
    saveRecentInstance({
      instanceId: instance.id,
      mapName: payload.mapName,
    })
    navigateTo(buildMapInstancePath(instance.id))
  }

  const handleJoinInstance = async (instanceId: string) => {
    navigateTo(buildMapInstancePath(instanceId.trim()))
  }

  const handleAdminLogin = async (payload: { username: string; password: string }) => {
    try {
      setAdminLoginLoading(true)

      const response = await loginAdmin(payload)
      setAdminAuthenticated(true, {
        tokenType: response.tokenType || 'Bearer',
        accessToken: response.accessToken,
        expireSeconds: response.expireSeconds,
      })
      setAdminLoggedIn(true)

      const redirect = new URLSearchParams(search).get('redirect')
      const safeRedirect =
        redirect && redirect.startsWith('/admin') ? redirect : ROUTES.adminDashboard
      navigateTo(safeRedirect, { replace: true })
    } catch (error) {
      console.warn('[App] Admin login failed', error)
    } finally {
      setAdminLoginLoading(false)
    }
  }

  const handleAdminLogout = () => {
    setAdminAuthenticated(false)
    setAdminLoggedIn(false)
    navigateTo(ROUTES.adminLogin)
  }

  let content: React.ReactNode = null

  if (route.name === 'home') {
    content = (
      <HomePage
        onCreateInstance={handleCreateInstance}
        onJoinInstance={handleJoinInstance}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    )
  } else if (route.name === 'map-instance') {
    content = (
      <MapInstancePage
        key={route.instanceId}
        instanceId={route.instanceId}
        onBackHome={() => navigateTo(ROUTES.home)}
      />
    )
  } else if (route.name === 'admin-login') {
    content = <AdminLoginPage onLogin={handleAdminLogin} loading={adminLoginLoading} />
  } else if (route.name === 'admin-dashboard') {
    content = adminLoggedIn ? (
      <AdminDashboardPage onNavigate={navigateTo} onLogout={handleAdminLogout} />
    ) : null
  } else if (route.name === 'admin-maps') {
    content = adminLoggedIn ? (
      <AdminMapsPage onNavigate={navigateTo} onLogout={handleAdminLogout} />
    ) : null
  } else if (route.name === 'admin-map-intel') {
    content = adminLoggedIn ? (
      <AdminMapIntelPage onNavigate={navigateTo} onLogout={handleAdminLogout} />
    ) : null
  } else if (route.name === 'admin-instances') {
    content = adminLoggedIn ? (
      <AdminInstancesPage onNavigate={navigateTo} onLogout={handleAdminLogout} />
    ) : null
  } else if (route.name === 'admin-password') {
    content = adminLoggedIn ? (
      <AdminPasswordPage onNavigate={navigateTo} onLogout={handleAdminLogout} />
    ) : null
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

  const shouldKeepViewportFixedChildren = route.name === 'home'
  const pageTransition =
    prefersReducedMotion || shouldKeepViewportFixedChildren
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: {
            duration: prefersReducedMotion ? 0.12 : 0.18,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        }
      : {
          initial: { opacity: 0, y: 14, filter: 'blur(8px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          exit: { opacity: 0, y: -10, filter: 'blur(6px)' },
          transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <>
      {isDesktopApp && isWindowsDesktop && (
        <Box
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          sx={{ position: 'fixed', inset: '0 0 auto 0', zIndex: 30, height: 40 }}
        />
      )}
      {isAdminShellRoute ? (
        content
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${route.name}:${currentPathWithSearch}`}
            initial={pageTransition.initial}
            animate={pageTransition.animate}
            exit={pageTransition.exit}
            transition={pageTransition.transition}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      )}
      <AnimatePresence>
        {settingsOpen && (
          <ApiSettingsDialog
            onClose={() => setSettingsOpen(false)}
            onOpenAdmin={() => {
              setSettingsOpen(false)
              navigateTo(ROUTES.adminLogin)
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key={toastMessage}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 80, maxWidth: 440 }}
          >
            <Paper
              variant="outlined"
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 3,
                borderColor: 'error.main',
                backgroundColor: 'rgba(70, 17, 17, 0.94)',
                color: 'error.contrastText',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.28)',
              }}
            >
              {toastMessage}
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default App
