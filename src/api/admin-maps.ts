import { http } from '../lib/http'
import type { AdminMap, AdminMapUpsertRequest } from '../types/admin'

interface AdminMapApiItem {
  id?: string | number
  code?: string
  nameZh?: string
  nameEn?: string
  sortOrder?: string | number
  sort_order?: string | number
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

const readNumber = (...values: Array<string | number | undefined>) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return undefined
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
  const bannerPath = readString(
    item.bannerPath,
    item.banner_path,
    item.bannerObjectName,
    item.banner_object_name,
    bannerUrl,
  )
  const mapPath = readString(
    item.mapPath,
    item.map_path,
    item.mapObjectName,
    item.map_object_name,
    mapUrl,
  )

  return {
    id,
    code: readString(item.code),
    nameZh: readString(item.nameZh, item.name_zh),
    nameEn: readString(item.nameEn, item.name_en),
    sortOrder: readNumber(item.sortOrder, item.sort_order),
    bannerPath,
    bannerUrl,
    mapPath,
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
      .filter((item): item is AdminMap => item !== null)
      .sort((a, b) => {
        const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER
        const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) {
          return aOrder - bOrder
        }
        return a.id - b.id
      }),
  )
}

export const createAdminMap = (payload: AdminMapUpsertRequest) => {
  return http
    .post<AdminMapApiItem>('/admin/maps', {
      nameZh: payload.nameZh,
      nameEn: payload.nameEn,
      bannerPath: payload.bannerPath,
      mapPath: payload.mapPath,
    })
    .then((item) => {
      const normalized = normalizeAdminMap(item)
      if (!normalized) {
        throw new Error('Invalid map payload from server')
      }
      return normalized
    })
}

export const updateAdminMap = (id: number, payload: AdminMapUpsertRequest) => {
  return http
    .put<AdminMapApiItem>(`/admin/maps/${id}`, {
      nameZh: payload.nameZh,
      nameEn: payload.nameEn,
      bannerPath: payload.bannerPath,
      mapPath: payload.mapPath,
    })
    .then((item) => {
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

export const reorderAdminMaps = (mapIds: number[]) => {
  return http.put<unknown>('/admin/maps/order', { mapIds }).then((payload) =>
    extractAdminMapItems(payload)
      .map(normalizeAdminMap)
      .filter((item): item is AdminMap => item !== null)
      .sort((a, b) => {
        const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER
        const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) {
          return aOrder - bOrder
        }
        return a.id - b.id
      }),
  )
}
