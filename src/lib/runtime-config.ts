import { APP_CONFIG } from '../config/app-config'
import { getInitialDesktopEnvironment } from './desktop'

const API_BASE_URL_STORAGE_KEY = 'tarkov.apiBaseUrl'

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

export const isElectronApp = () => {
  const desktopEnvironment = getInitialDesktopEnvironment()
  return desktopEnvironment.isElectron || desktopEnvironment.isTauri
}

export const getDefaultApiBaseUrl = () => {
  const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl
  }

  if (import.meta.env.PROD) {
    return APP_CONFIG.productionApiBaseUrl
  }

  return APP_CONFIG.defaultApiBaseUrl
}

export const getApiBaseUrl = () => {
  const stored = window.localStorage.getItem(API_BASE_URL_STORAGE_KEY)
  if (stored) {
    const normalizedStored = normalizeBaseUrl(stored)
    if (normalizedStored) {
      return normalizedStored
    }
  }

  return normalizeBaseUrl(getDefaultApiBaseUrl()) || APP_CONFIG.defaultApiBaseUrl
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
