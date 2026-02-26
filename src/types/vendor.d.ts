declare module 'qs' {
  export interface IStringifyOptions {
    addQueryPrefix?: boolean
    allowDots?: boolean
    arrayFormat?: 'indices' | 'brackets' | 'repeat' | 'comma'
    skipNulls?: boolean
  }

  export function stringify(
    obj: Record<string, unknown>,
    options?: IStringifyOptions,
  ): string
}

declare module 'lodash-es' {
  export function debounce<T extends (...args: never[]) => unknown>(
    func: T,
    wait?: number,
  ): (...args: Parameters<T>) => ReturnType<T>

  export function throttle<T extends (...args: never[]) => unknown>(
    func: T,
    wait?: number,
  ): (...args: Parameters<T>) => ReturnType<T>
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  desktopApp?: {
    isElectron: boolean
    platform?: string
  }
}
