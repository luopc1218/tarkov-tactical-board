import { http } from '../lib/http'
import type { AdminWhiteboardInstance, AdminWhiteboardInstancePage } from '../types/admin'

interface ListAdminWhiteboardInstancesParams {
  includeExpired?: boolean
  page?: number
  size?: number
}

type PaginatedPayload<T> = {
  records?: T[]
  items?: T[]
  list?: T[]
  content?: T[]
  total?: number | string
  totalElements?: number | string
  count?: number | string
  current?: number | string
  page?: number | string
  number?: number | string
  size?: number | string
  pageSize?: number | string
  pages?: number | string
  totalPages?: number | string
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const readBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }
  return fallback
}

const readNumber = (value: unknown): number | null => {
  const candidate = Number(value)
  if (!Number.isFinite(candidate)) {
    return null
  }
  return candidate
}

const pickString = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = readString(source[key])
    if (value) {
      return value
    }
  }
  return null
}

const pickNumber = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = readNumber(source[key])
    if (value !== null) {
      return value
    }
  }
  return null
}

const normalizeInstance = (raw: unknown): AdminWhiteboardInstance | null => {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const source = raw as Record<string, unknown>
  const instanceId = pickString(source, ['instanceId', 'instance_id', 'id'])
  if (!instanceId) {
    return null
  }
  const mapNameZh = pickString(source, ['mapNameZh', 'map_name_zh', 'mapZhName', 'map_zh_name'])
  const mapNameEn = pickString(source, ['mapNameEn', 'map_name_en', 'mapEnName', 'map_en_name'])
  const mapName =
    pickString(source, [
      'mapName',
      'map_name',
      'mapDisplayName',
      'map_display_name',
      'mapTitle',
      'map_title',
      'mapLabel',
      'map_label',
      'mapCode',
      'map_code',
    ]) ??
    mapNameZh ??
    mapNameEn

  return {
    instanceId,
    mapNameZh,
    mapNameEn,
    mapName,
    mapId: pickNumber(source, ['mapId', 'map_id']) ?? undefined,
    createdAt:
      pickString(source, ['createdAt', 'created_at', 'createTime', 'create_time']) ?? '',
    updatedAt:
      pickString(source, ['updatedAt', 'updated_at', 'updateTime', 'update_time']) ?? '',
    expireAt:
      pickString(source, ['expireAt', 'expire_at', 'expiredAt', 'expired_at']) ?? '',
    active: readBoolean(source.active ?? source.isActive ?? source.is_active),
    hasState: readBoolean(source.hasState ?? source.has_state),
  }
}

const toPositiveNumber = (value: unknown, fallback: number) => {
  const candidate = Number(value)
  if (!Number.isFinite(candidate) || candidate <= 0) {
    return fallback
  }
  return Math.floor(candidate)
}

const parseListPayload = (
  payload: AdminWhiteboardInstance[] | PaginatedPayload<AdminWhiteboardInstance>,
  fallbackPage: number,
  fallbackSize: number
): AdminWhiteboardInstancePage => {
  if (Array.isArray(payload)) {
    const normalizedItems = payload
      .map((item) => normalizeInstance(item))
      .filter((item): item is AdminWhiteboardInstance => item !== null)
    const total = normalizedItems.length
    const pages = Math.max(1, Math.ceil(total / fallbackSize))
    return {
      items: normalizedItems,
      total,
      page: fallbackPage,
      size: fallbackSize,
      pages,
    }
  }

  const items =
    payload.records ??
    payload.items ??
    payload.list ??
    payload.content ??
    []
  const safeItems = (Array.isArray(items) ? items : [])
    .map((item) => normalizeInstance(item))
    .filter((item): item is AdminWhiteboardInstance => item !== null)
  const total = toPositiveNumber(
    payload.total ?? payload.totalElements ?? payload.count,
    safeItems.length
  )
  const page = toPositiveNumber(
    payload.current ??
      payload.page ??
      (Number.isFinite(Number(payload.number)) ? Number(payload.number) + 1 : undefined),
    fallbackPage
  )
  const size = toPositiveNumber(payload.size ?? payload.pageSize, fallbackSize)
  const pages = toPositiveNumber(
    payload.pages ?? payload.totalPages,
    Math.max(1, Math.ceil(total / Math.max(1, size)))
  )

  return {
    items: safeItems,
    total,
    page,
    size,
    pages,
  }
}

export const listAdminWhiteboardInstances = ({
  includeExpired = true,
  page = 1,
  size = 20,
}: ListAdminWhiteboardInstancesParams = {}) => {
  return http
    .get<AdminWhiteboardInstance[] | PaginatedPayload<AdminWhiteboardInstance>>(
      '/admin/whiteboard/instances',
      {
        params: {
          includeExpired,
          page,
          size,
          current: page,
          pageSize: size,
        },
      }
    )
    .then((payload) => parseListPayload(payload, page, size))
}

export const deleteAdminWhiteboardInstance = (instanceId: string) => {
  return http.delete<void>(`/admin/whiteboard/instances/${encodeURIComponent(instanceId)}`)
}

export const clearAllAdminWhiteboardInstances = () => {
  return http.delete<void>('/admin/whiteboard/instances')
}
