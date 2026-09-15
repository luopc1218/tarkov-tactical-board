const API_BASE_URL_STORAGE_KEY = 'tarkov.apiBaseUrl'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed === '/') {
    return trimmed
  }

  return trimmed.replace(/\/+$/, '')
}

// The app may be mounted under a base path (e.g. /eftboard/) or at the origin root
// (Tauri serves from /). Resolve relative API bases against that path so requests are
// never resolved relative to the current SPA route (which caused /instances/api/...).
const getAppBasePath = () => {
  const base = import.meta.env.BASE_URL?.trim() || '/'
  if (ABSOLUTE_URL_PATTERN.test(base) || base.startsWith('//')) {
    return base
  }
  return base.startsWith('/') ? base : '/'
}

const resolveApiBaseUrl = (value: string) => {
  const normalized = normalizeBaseUrl(value)
  if (!normalized) {
    return ''
  }

  if (
    ABSOLUTE_URL_PATTERN.test(normalized) ||
    normalized.startsWith('//') ||
    normalized.startsWith('/')
  ) {
    return normalized
  }

  const base = getAppBasePath()
  const baseWithSlash = base.endsWith('/') ? base : `${base}/`
  try {
    return new URL(normalized, `http://localhost${baseWithSlash}`).pathname
  } catch {
    return normalized
  }
}

const getDefaultApiBaseUrlFromBase = () => {
  const baseUrl = import.meta.env.BASE_URL?.trim() || '/'

  if (baseUrl === './') {
    return './api'
  }

  if (baseUrl === '/') {
    return '/api'
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${normalizedBase}/api`
}

export const getDefaultApiBaseUrl = () => {
  const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configuredApiBaseUrl) {
    return normalizeBaseUrl(configuredApiBaseUrl) || getDefaultApiBaseUrlFromBase()
  }

  return getDefaultApiBaseUrlFromBase()
}

export const getApiBaseUrl = () => {
  const stored = window.localStorage.getItem(API_BASE_URL_STORAGE_KEY)
  if (stored) {
    const resolvedStored = resolveApiBaseUrl(stored)
    if (resolvedStored) {
      return resolvedStored
    }
  }

  return resolveApiBaseUrl(getDefaultApiBaseUrl()) || getDefaultApiBaseUrlFromBase()
}

export const setApiBaseUrl = (value: string) => {
  const normalized = normalizeBaseUrl(value)

  if (!normalized) {
    window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY)
  } else {
    window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized)
  }

  window.dispatchEvent(new CustomEvent('api-base-url-changed', { detail: getApiBaseUrl() }))
}
