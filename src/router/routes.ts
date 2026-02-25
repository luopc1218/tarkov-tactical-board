export const ROUTES = {
  home: '/',
  adminLogin: '/admin/login',
  adminDashboard: '/admin/dashboard',
  adminMaps: '/admin/maps',
  adminInstances: '/admin/instances',
  adminPassword: '/admin/password',
} as const

const MAP_INSTANCE_PATH_REGEX = /^\/instances\/([^/]+)$/
const ADMIN_PATH_REGEX = /^\/admin(?:\/([^/]+))?$/

export const buildMapInstancePath = (instanceId: string) => `/instances/${instanceId}`

export type AppRoute =
  | { name: 'home' }
  | { name: 'map-instance'; instanceId: string }
  | { name: 'admin-login' }
  | { name: 'admin-dashboard' }
  | { name: 'admin-maps' }
  | { name: 'admin-instances' }
  | { name: 'admin-password' }
  | { name: 'admin-not-found' }
  | { name: 'not-found' }

export const resolveRoute = (pathname: string): AppRoute => {
  if (pathname === ROUTES.home) {
    return { name: 'home' }
  }

  const match = pathname.match(MAP_INSTANCE_PATH_REGEX)
  if (match) {
    return {
      name: 'map-instance',
      instanceId: decodeURIComponent(match[1]),
    }
  }

  const adminMatch = pathname.match(ADMIN_PATH_REGEX)
  if (adminMatch) {
    const section = adminMatch[1] ?? 'dashboard'

    if (section === 'login') {
      return { name: 'admin-login' }
    }
    if (section === 'dashboard') {
      return { name: 'admin-dashboard' }
    }
    if (section === 'maps') {
      return { name: 'admin-maps' }
    }
    if (section === 'instances') {
      return { name: 'admin-instances' }
    }
    if (section === 'password') {
      return { name: 'admin-password' }
    }

    return { name: 'admin-not-found' }
  }

  return { name: 'not-found' }
}
