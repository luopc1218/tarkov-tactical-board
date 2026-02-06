import { http } from '../lib/http'
import type { LoginRequest, LoginResponse } from '../types/admin'

export const loginAdmin = (payload: LoginRequest) => {
  return http.post<LoginResponse>('/auth/login', payload)
}
