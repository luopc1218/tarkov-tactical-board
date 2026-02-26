import { http } from '../lib/http'
import type { AdminMap, AdminMapUpsertRequest } from '../types/admin'

interface AdminMapApiItem {
  id?: string | number
  code?: string
  nameZh?: string
  nameEn?: string
  name_zh?: string
  name_en?: string
  bannerObjectName?: string
  banner_object_name?: string
  bannerUrl?: string
  banner_url?: string
  bannerPath?: string
  banner_path?: string
  mapObjectName?: string
  map_object_name?: string
  mapUrl?: string
  map_url?: string
  mapPath?: string
  map_path?: string
}

interface AdminMapContainer {
  maps?: AdminMapApiItem[]
  list?: AdminMapApiItem[]
  items?: AdminMapApiItem[]
  records?: AdminMapApiItem[]
  result?: AdminMapApiItem[]
  rows?: AdminMapApiItem[]
}

const readString = (...values: Array<string | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

const normalizeAdminMap = (item: AdminMapApiItem): AdminMap | null => {
  const idValue = item.id
  const id =
    typeof idValue === 'number'
      ? idValue
      : typeof idValue === 'string' && idValue.trim()
        ? Number(idValue)
        : NaN
  if (!Number.isFinite(id)) {
    return null
  }

  const bannerUrl = readString(item.bannerUrl, item.banner_url, item.bannerPath, item.banner_path)
  const mapUrl = readString(item.mapUrl, item.map_url, item.mapPath, item.map_path)
  const bannerObjectName = readString(
    item.bannerObjectName,
    item.banner_object_name,
    item.bannerPath,
    item.banner_path,
    bannerUrl,
  )
  const mapObjectName = readString(
    item.mapObjectName,
    item.map_object_name,
    item.mapPath,
    item.map_path,
    mapUrl,
  )

  return {
    id,
    code: readString(item.code),
    nameZh: readString(item.nameZh, item.name_zh),
    nameEn: readString(item.nameEn, item.name_en),
    bannerObjectName,
    bannerUrl,
    mapObjectName,
    mapUrl,
  }
}

const extractAdminMapItems = (payload: unknown): AdminMapApiItem[] => {
  if (Array.isArray(payload)) {
    return payload as AdminMapApiItem[]
  }

  if (payload && typeof payload === 'object') {
    const container = payload as AdminMapContainer
    return (
      container.maps ??
      container.list ??
      container.items ??
      container.records ??
      container.result ??
      container.rows ??
      []
    )
  }

  return []
}

export const listAdminMaps = () => {
  return http.get<unknown>('/admin/maps').then((payload) =>
    extractAdminMapItems(payload)
      .map(normalizeAdminMap)
      .filter((item): item is AdminMap => item !== null),
  )
}

export const createAdminMap = (payload: AdminMapUpsertRequest) => {
  return http.post<AdminMapApiItem>('/admin/maps', payload).then((item) => {
    const normalized = normalizeAdminMap(item)
    if (!normalized) {
      throw new Error('Invalid map payload from server')
    }
    return normalized
  })
}

export const updateAdminMap = (id: number, payload: AdminMapUpsertRequest) => {
  return http.put<AdminMapApiItem>(`/admin/maps/${id}`, payload).then((item) => {
    const normalized = normalizeAdminMap(item)
    if (!normalized) {
      throw new Error('Invalid map payload from server')
    }
    return normalized
  })
}

export const deleteAdminMap = (id: number) => {
  return http.delete<void>(`/admin/maps/${id}`)
}
