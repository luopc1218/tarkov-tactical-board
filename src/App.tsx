import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FiSettings } from 'react-icons/fi'
import { loginAdmin } from './api/admin-auth'
import { createWhiteboardInstance } from './api/whiteboard'
import { ApiSettingsDialog } from './components/ApiSettingsDialog'
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
  const isElectronFilePage = window.location.protocol === 'file:'
  const isGithubPagesBuild = getWebBasePath().length > 0
  return isElectronFilePage || isGithubPagesBuild
}

const navigateTo = (path: string) => {
  if (shouldUseHashRouting()) {
    window.history.pushState(null, '', `#${path}`)
  } else {
    window.history.pushState(null, '', path)
  }
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const getNormalizedLocation = () => {
  const { pathname, protocol, hash, search } = window.location
  const isElectronFilePage = protocol === 'file:'
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

  if (!isElectronFilePage) {
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
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const desktopPlatform = window.desktopApp?.platform
  const isDesktopApp = Boolean(window.desktopApp?.isElectron)
  const isWindowsDesktop = desktopPlatform === 'win32'
  const isWebApp = !isDesktopApp
  const [pathname, setPathname] = useState(() => getNormalizedLocation().pathname)
  const [search, setSearch] = useState(() => getNormalizedLocation().search)
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => isAdminAuthenticated())
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const shouldShowSettingsEntry = desktopPlatform !== 'darwin'

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

    const platform = window.desktopApp?.platform
    const safeTop = platform === 'darwin' ? 48 : platform === 'win32' ? 40 : 0
    const safeRight = platform === 'win32' ? 144 : 0
    const windowControlsWidth = platform === 'win32' ? 138 : 0
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
  }, [shouldShowSettingsEntry])

  useEffect(() => {
    const platform = window.desktopApp?.platform ?? 'web'
    document.documentElement.setAttribute('data-platform', platform)

    return () => {
      document.documentElement.removeAttribute('data-platform')
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.desktopApp?.onOpenSettings?.(() => {
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
    route.name === 'admin-instances' ||
    route.name === 'admin-password'
  const isAdminShellRoute =
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
      navigateTo(safeRedirect)
    } catch {
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
      <HomePage onCreateInstance={handleCreateInstance} onJoinInstance={handleJoinInstance} />
    )
  } else if (route.name === 'map-instance') {
    content = (
      <MapInstancePage instanceId={route.instanceId} onBackHome={() => navigateTo(ROUTES.home)} />
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

  const pageTransition = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] as const },
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
        <div
          className="fixed inset-x-0 top-0 z-30 h-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
      )}
      {shouldShowSettingsEntry &&
        (isWindowsDesktop || isWebApp ? (
          <button
            type="button"
            aria-label={t('settings.title')}
            title={`${t('settings.title')} (Cmd/Ctrl + ,)`}
            onClick={() => setSettingsOpen(true)}
            className="group fixed z-40 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-500/75 bg-slate-900/65 text-slate-200 backdrop-blur transition hover:border-amber-300/70 hover:text-white"
            style={
              {
                top: isWindowsDesktop ? 1 : 12,
                left: isWindowsDesktop ? 6 : undefined,
                right: isWindowsDesktop ? undefined : 16,
                ...(isWindowsDesktop
                  ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties)
                  : {}),
              } as React.CSSProperties
            }
          >
            <FiSettings className="text-[0.92rem] transition" />
          </button>
        ) : (
          <div
            className="fixed right-4 z-40 flex items-center rounded-full border border-slate-500/75 bg-slate-900/65 px-2 py-1 text-slate-200 shadow-sm backdrop-blur"
            style={{
              top: 'calc(0.75rem + var(--desktop-titlebar-safe-top))',
              right: 'calc(1rem + var(--desktop-titlebar-safe-right))',
            }}
          >
            <button
              type="button"
              aria-label={t('settings.title')}
              title={`${t('settings.title')} (Cmd/Ctrl + ,)`}
              onClick={() => setSettingsOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-500/80 bg-slate-800/90 text-slate-100 transition hover:border-amber-300/70 hover:bg-slate-700"
            >
              <FiSettings />
            </button>
          </div>
        ))}
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
        {settingsOpen && <ApiSettingsDialog onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key={toastMessage}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-6 right-6 z-[80] max-w-md rounded-xl border border-rose-400/45 bg-rose-950/92 px-4 py-3 text-sm text-rose-100 shadow-lg"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default App
