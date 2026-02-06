const ADMIN_AUTH_STORAGE_KEY = 'tarkov_tactical_board_admin_auth'

interface AdminSession {
  tokenType: string
  accessToken: string
  expiresAt: number
  loggedInAt: number
}

const readAdminSession = (): AdminSession | null => {
  const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as AdminSession
    if (!parsed.accessToken || !parsed.tokenType || !parsed.expiresAt) {
      return null
    }

    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
      return null
    }

    return parsed
  } catch {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
    return null
  }
}

export const isAdminAuthenticated = () => {
  return Boolean(readAdminSession())
}

export const getAdminAccessToken = () => {
  const session = readAdminSession()
  if (!session) {
    return null
  }

  return `${session.tokenType} ${session.accessToken}`
}

export const setAdminAuthenticated = (
  authenticated: boolean,
  payload?: { tokenType: string; accessToken: string; expireSeconds: number },
) => {
  if (!authenticated || !payload) {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
    return
  }

  const session: AdminSession = {
    tokenType: payload.tokenType || 'Bearer',
    accessToken: payload.accessToken,
    expiresAt: Date.now() + Math.max(payload.expireSeconds, 1) * 1000,
    loggedInAt: Date.now(),
  }
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(session))
}
