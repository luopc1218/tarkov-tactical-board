import { http } from '../lib/http'
import type { AdminMap, AdminMapUpsertRequest } from '../types/admin'

export const listAdminMaps = () => {
  return http.get<AdminMap[]>('/admin/maps')
}

export const createAdminMap = (payload: AdminMapUpsertRequest) => {
  return http.post<AdminMap>('/admin/maps', payload)
}

export const updateAdminMap = (id: number, payload: AdminMapUpsertRequest) => {
  return http.put<AdminMap>(`/admin/maps/${id}`, payload)
}

export const deleteAdminMap = (id: number) => {
  return http.delete<void>(`/admin/maps/${id}`)
}
