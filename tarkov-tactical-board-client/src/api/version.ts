import axios from 'axios'
import { getApiBaseUrl } from '../lib/runtime-config'

export interface AppVersionInfo {
  version: string
  buildTime?: string
}

interface VersionResponse {
  version?: string
  buildTime?: string
}

// Version lookup is best-effort: it must not surface global API error toasts.
export const fetchAppVersion = async (): Promise<AppVersionInfo | null> => {
  try {
    const response = await axios.get<VersionResponse>('/version', {
      baseURL: getApiBaseUrl(),
      timeout: 8000,
    })
    const version =
      typeof response.data?.version === 'string' ? response.data.version.trim() : ''
    if (!version) {
      return null
    }

    const buildTime =
      typeof response.data?.buildTime === 'string' && response.data.buildTime.trim()
        ? response.data.buildTime.trim()
        : undefined

    return { version, buildTime }
  } catch {
    return null
  }
}
