import type { BossRefreshIntelItem, ExtractionIntelItem, MapIntelResponse } from './whiteboard'
import { resolveImagePath } from './files'
import { http } from '../lib/http'

export interface AdminMapIntelSummary {
  mapId: number
  mapNameZh: string
  mapNameEn: string
  syncedAt: string | null
  bossRefresh: MapIntelResponse['bossRefresh']
  extractions: ExtractionIntelItem[]
  errorMessage?: string
}

export type AdminMapIntelDetail = AdminMapIntelSummary

interface AdminMapIntelApiItem {
  mapId?: string | number
  map_id?: string | number
  id?: string | number
  mapNameZh?: string
  map_name_zh?: string
  nameZh?: string
  name_zh?: string
  mapNameEn?: string
  map_name_en?: string
  nameEn?: string
  name_en?: string
  syncedAt?: string | null
  synced_at?: string | null
  updatedAt?: string | null
  updated_at?: string | null
  errorMessage?: string
  error_message?: string
  bossRefresh?: unknown
  boss_refresh?: unknown
  extractions?: unknown
}

interface AdminMapIntelContainer {
  maps?: AdminMapIntelApiItem[]
  list?: AdminMapIntelApiItem[]
  items?: AdminMapIntelApiItem[]
  rows?: AdminMapIntelApiItem[]
  records?: AdminMapIntelApiItem[]
  result?: AdminMapIntelApiItem[]
}

const isNonNull = <T>(value: T | null): value is T => value !== null

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

const pickString = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) {
        return trimmed
      }
    }
  }
  return undefined
}

const pickNullableString = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (value == null) {
      return null
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed || null
    }
  }
  return null
}

const pickNumber = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
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

const formatChance = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || '-'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const percent = value > 0 && value <= 1 ? value * 100 : value
    return `${Number(percent.toFixed(percent % 1 === 0 ? 0 : 1))}%`
  }
  return '-'
}

const normalizeBossRefreshGroup = (
  group: unknown,
  groupName: 'regular' | 'pve',
): BossRefreshIntelItem[] => {
  if (Array.isArray(group)) {
    return group
      .map((item, index) => {
        const source = asRecord(item)
        if (!source) {
          return null
        }
        const name =
          pickString(source, ['bossNameZh', 'nameZh', 'name', 'bossName', 'label', 'title']) ??
          `${groupName.toUpperCase()}-${index + 1}`
        const nameSecondary = pickString(source, ['bossName', 'nameEn'])
        const chance =
          source.spawnChance ?? source.rate ?? source.chance ?? source.refreshRate ?? source.value

        return {
          id: `${groupName}-${index}-${name}`,
          name,
          nameSecondary: nameSecondary && nameSecondary !== name ? nameSecondary : undefined,
          chanceText: formatChance(chance),
        }
      })
      .filter(isNonNull)
  }

  const source = asRecord(group)
  if (!source) {
    return []
  }

  return Object.entries(source).map(([name, value], index) => ({
    id: `${groupName}-${index}-${name}`,
    name,
    chanceText: formatChance(value),
  }))
}

const pickBoolean = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number') {
      return value !== 0
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'y', 'always'].includes(normalized)) {
        return true
      }
      if (['false', '0', 'no', 'n', 'never'].includes(normalized)) {
        return false
      }
    }
  }
  return null
}

const pickStringArray = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value)) {
      const items = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
      if (items.length > 0) {
        return items
      }
    }
    if (typeof value === 'string') {
      const items = value
        .split(/[、,/|]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
      if (items.length > 0) {
        return items
      }
    }
  }
  return []
}

const pickNestedStringArray = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (!Array.isArray(value)) {
      continue
    }
    const items = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
    if (items.length > 0) {
      return items
    }
  }
  return []
}

const humanizeKey = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())

const toDisplayValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return undefined
}

const collectExtraDetails = (source: Record<string, unknown>, ignoredKeys: string[]) => {
  const ignored = new Set(ignoredKeys)
  return Object.entries(source)
    .filter(([key]) => !ignored.has(key))
    .map(([key, value]) => {
      const displayValue = toDisplayValue(value)
      if (!displayValue) {
        return null
      }
      return {
        label: humanizeKey(key),
        value: displayValue,
      }
    })
    .filter((item): item is { label: string; value: string } => item !== null)
}

const normalizeExtractions = (value: unknown): ExtractionIntelItem[] => {
  const sourceRoot = asRecord(value)
  const points = Array.isArray(value)
    ? value
    : sourceRoot && Array.isArray(sourceRoot.points)
      ? sourceRoot.points
      : []

  if (!Array.isArray(points)) {
    return []
  }

  return points
    .map((item, index) => {
      const source = asRecord(item)
      if (!source) {
        return null
      }
      const detail = asRecord(source.detail) ?? {}
      const name =
        pickString(source, ['name', 'title', 'extractName', 'extractionName']) ??
        pickString(detail, ['name', 'title', 'extractName', 'extractionName'])

      if (!name) {
        return null
      }

      return {
        id: pickString(source, ['id', 'extractId', 'code']) ?? `extract-${index}-${name}`,
        name,
        factions:
          pickStringArray(source, ['factions', 'faction', 'sides', 'side', 'camp']) ||
          pickStringArray(detail, ['factions', 'faction', 'sides', 'side', 'camp']),
        requirement:
          pickString(source, ['requirement', 'requirements', 'condition', 'conditions', 'need']) ??
          pickString(detail, ['requirement', 'requirements', 'condition', 'conditions', 'need']),
        alwaysAvailable: pickBoolean(detail, [
          'alwaysAvailable',
          'always_available',
          'isAlwaysOpen',
          'is_always_open',
        ]),
        oneTime: pickBoolean(detail, ['oneTime', 'one_time', 'singleUse', 'single_use']),
        detailImageUrls: [
          ...pickStringArray(source, ['detailImageUrls', 'detailImages']),
          ...pickStringArray(detail, ['detailImageUrls', 'detailImages']),
          ...pickNestedStringArray(detail, ['imageUrls', 'images']),
          ...pickNestedStringArray(source, ['imageUrls', 'images']),
        ]
          .map((item) => resolveImagePath(item) ?? item)
          .filter((item, itemIndex, list) => item.length > 0 && list.indexOf(item) === itemIndex),
        detailUrl:
          pickString(source, ['detailUrl', 'url', 'link']) ??
          pickString(detail, ['detailUrl', 'url', 'link']),
        description:
          pickString(source, ['description', 'desc', 'remark', 'notes']) ??
          pickString(detail, ['description', 'desc', 'remark', 'notes']),
        location:
          pickString(source, ['location', 'position', 'area']) ??
          pickString(detail, ['location', 'position', 'area']),
        extraDetails: collectExtraDetails(
          { ...detail, ...source },
          [
            'id',
            'extractId',
            'code',
            'name',
            'title',
            'extractName',
            'extractionName',
            'factions',
            'faction',
            'sides',
            'side',
            'camp',
            'requirement',
            'requirements',
            'condition',
            'conditions',
            'need',
            'alwaysAvailable',
            'always_available',
            'isAlwaysOpen',
            'is_always_open',
            'oneTime',
            'one_time',
            'singleUse',
            'single_use',
            'detailImageUrls',
            'detailImages',
            'images',
            'detailUrl',
            'url',
            'link',
            'description',
            'desc',
            'remark',
            'notes',
            'location',
            'position',
            'area',
            'detail',
          ],
        ),
      }
    })
    .filter(isNonNull)
}

const normalizeMapIntelSummary = (item: AdminMapIntelApiItem): AdminMapIntelSummary | null => {
  const source = asRecord(item) ?? {}
  const mapId = pickNumber(source, ['mapId', 'map_id', 'id'])
  if (mapId == null) {
    return null
  }

  const bossRefreshSource = source.bossRefresh ?? source.boss_refresh ?? {}

  return {
    mapId,
    mapNameZh: pickString(source, ['mapNameZh', 'map_name_zh', 'nameZh', 'name_zh']) ?? '',
    mapNameEn: pickString(source, ['mapNameEn', 'map_name_en', 'nameEn', 'name_en']) ?? '',
    syncedAt: pickNullableString(source, ['syncedAt', 'synced_at', 'updatedAt', 'updated_at']),
    errorMessage: pickString(source, ['errorMessage', 'error_message', 'message']),
    bossRefresh: {
      regular: normalizeBossRefreshGroup(
        asRecord(bossRefreshSource)?.regular ?? bossRefreshSource,
        'regular',
      ),
      pve: normalizeBossRefreshGroup(asRecord(bossRefreshSource)?.pve, 'pve'),
    },
    extractions: normalizeExtractions(source.extractions),
  }
}

const extractAdminMapIntelItems = (payload: unknown): AdminMapIntelApiItem[] => {
  if (Array.isArray(payload)) {
    return payload as AdminMapIntelApiItem[]
  }

  if (payload && typeof payload === 'object') {
    const container = payload as AdminMapIntelContainer
    return (
      container.maps ??
      container.list ??
      container.items ??
      container.rows ??
      container.records ??
      container.result ??
      []
    )
  }

  return []
}

export const listAdminMapIntelMaps = () => {
  return http.get<unknown>('/admin/map-intel/maps').then((payload) =>
    extractAdminMapIntelItems(payload)
      .map(normalizeMapIntelSummary)
      .filter((item): item is AdminMapIntelSummary => item !== null)
      .sort((a, b) => a.mapId - b.mapId),
  )
}

export const getAdminMapIntelMap = (mapId: number) => {
  return http.get<unknown>(`/admin/map-intel/maps/${mapId}`).then((payload) => {
    const normalized = normalizeMapIntelSummary(payload as AdminMapIntelApiItem)
    if (!normalized) {
      throw new Error('Invalid map intel payload from server')
    }
    return normalized as AdminMapIntelDetail
  })
}

export const syncAdminMapIntelMap = (mapId: number) => {
  return http.post<void>(`/admin/map-intel/maps/${mapId}/sync`)
}

export const syncAllAdminMapIntelMaps = () => {
  return http.post<void>('/admin/map-intel/sync-all')
}
