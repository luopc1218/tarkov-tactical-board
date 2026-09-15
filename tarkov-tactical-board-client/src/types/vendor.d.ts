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

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WS_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

interface Window {
  __TAURI_INTERNALS__?: unknown
}
