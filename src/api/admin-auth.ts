import { http } from '../lib/http'
import type { ChangePasswordRequest, ChangePasswordResponse, LoginRequest, LoginResponse } from '../types/admin'

export const loginAdmin = (payload: LoginRequest) => {
  return http.post<LoginResponse>('/auth/login', payload)
}

export const changeAdminPassword = (payload: ChangePasswordRequest) => {
  return http.put<ChangePasswordResponse>('/admin/auth/password', payload)
}
