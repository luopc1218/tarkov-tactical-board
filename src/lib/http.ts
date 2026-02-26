import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { getAdminAccessToken } from '../features/admin-auth'
import qs from 'qs'
import { getApiBaseUrl } from './runtime-config'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

const emitHttpError = (message: string) => {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent('http-error', { detail: { message } }))
}

const httpInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  paramsSerializer: (params) =>
    qs.stringify(params, {
      arrayFormat: 'repeat',
      skipNulls: true,
    }),
})

httpInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message ?? error.message ?? 'Request failed'
    emitHttpError(message)
    return Promise.reject(new Error(message))
  },
)

httpInstance.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()

  const token = getAdminAccessToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = token
  }

  return config
})

const unwrapResponse = <T>(response: AxiosResponse<ApiResponse<T> | T>): T => {
  const payload = response.data

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data
  }

  return payload as T
}

export const http = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return httpInstance.get<ApiResponse<T> | T>(url, config).then(unwrapResponse)
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return httpInstance.post<ApiResponse<T> | T>(url, data, config).then(unwrapResponse)
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return httpInstance.put<ApiResponse<T> | T>(url, data, config).then(unwrapResponse)
  },
  delete<T>(url: string, config?: AxiosRequestConfig) {
    return httpInstance.delete<ApiResponse<T> | T>(url, config).then(unwrapResponse)
  },
}

export const getCurrentApiBaseUrl = () => getApiBaseUrl()
