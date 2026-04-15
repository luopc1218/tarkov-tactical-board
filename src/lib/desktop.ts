export type DesktopPlatform = 'darwin' | 'win32' | 'linux' | 'web'
export type DesktopKind = 'electron' | 'tauri' | 'web'

export interface DesktopEnvironment {
  kind: DesktopKind
  platform: DesktopPlatform
  isDesktopApp: boolean
  isElectron: boolean
  isTauri: boolean
}

const WEB_DESKTOP_ENVIRONMENT: DesktopEnvironment = {
  kind: 'web',
  platform: 'web',
  isDesktopApp: false,
  isElectron: false,
  isTauri: false,
}

const TAURI_PLATFORM_MAP: Record<string, DesktopPlatform> = {
  macos: 'darwin',
  darwin: 'darwin',
  windows: 'win32',
  win32: 'win32',
  linux: 'linux',
}

const normalizePlatform = (value?: string | null): DesktopPlatform => {
  if (!value) {
    return 'web'
  }

  return TAURI_PLATFORM_MAP[value.toLowerCase()] ?? 'web'
}

export const isTauriApp = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export const getInitialDesktopEnvironment = (): DesktopEnvironment => {
  if (window.desktopApp?.isElectron) {
    return {
      kind: 'electron',
      platform: normalizePlatform(window.desktopApp.platform),
      isDesktopApp: true,
      isElectron: true,
      isTauri: false,
    }
  }

  if (isTauriApp()) {
    return {
      kind: 'tauri',
      platform: 'web',
      isDesktopApp: true,
      isElectron: false,
      isTauri: true,
    }
  }

  return WEB_DESKTOP_ENVIRONMENT
}

export const resolveDesktopEnvironment = async (): Promise<DesktopEnvironment> => {
  const initialEnvironment = getInitialDesktopEnvironment()
  if (!initialEnvironment.isTauri) {
    return initialEnvironment
  }

  try {
    const { platform } = await import('@tauri-apps/plugin-os')
    return {
      ...initialEnvironment,
      platform: normalizePlatform(platform()),
    }
  } catch (error) {
    console.warn('[desktop] Failed to resolve Tauri platform', error)
    return initialEnvironment
  }
}

export const isDesktopHashRouting = () => {
  const environment = getInitialDesktopEnvironment()
  return environment.isElectron || environment.isTauri
}

export const addOpenSettingsListener = (callback: () => void) => {
  const environment = getInitialDesktopEnvironment()

  if (environment.isElectron) {
    return window.desktopApp?.onOpenSettings?.(callback) ?? (() => {})
  }

  if (!environment.isTauri) {
    return () => {}
  }

  let disposed = false
  let cleanup = () => {}

  void import('@tauri-apps/api/event')
    .then(({ listen }) =>
      listen('app:open-settings', () => {
        callback()
      }),
    )
    .then((unlisten) => {
      if (disposed) {
        unlisten()
        return
      }

      cleanup = unlisten
    })
    .catch((error) => {
      console.warn('[desktop] Failed to subscribe to settings event', error)
    })

  return () => {
    disposed = true
    cleanup()
  }
}
