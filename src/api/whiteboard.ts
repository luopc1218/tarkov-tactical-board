import { http } from '../lib/http'
import type { MapInstance } from '../types/map-instance'

interface WhiteboardInstanceResponse {
  instanceId: string
  mapId: number
  createdAt?: string
}

export interface WhiteboardStateResponse {
  instanceId: string
  state: unknown
  updatedAt?: string
  expireAt?: string
}

export interface BossRefreshIntelItem {
  id: string
  name: string
  nameSecondary?: string
  chanceText: string
}

export interface ExtractionIntelItem {
  id: string
  name: string
  factions: string[]
  requirement?: string
  alwaysAvailable: boolean | null
  oneTime: boolean | null
  detailImageUrls: string[]
  detailUrl?: string
  description?: string
  location?: string
  extraDetails: Array<{ label: string; value: string }>
}

export interface MapIntelResponse {
  errorMessage?: string
  mapNameZh?: string
  mapNameEn?: string
  bossRefresh: {
    regular: BossRefreshIntelItem[]
    pve: BossRefreshIntelItem[]
  }
  extractions: ExtractionIntelItem[]
}

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

const formatChance = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return '-'
    }
    return trimmed.includes('%') ? trimmed : trimmed
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
    const normalized: BossRefreshIntelItem[] = []
    group.forEach((item, index) => {
      const source = asRecord(item)
      if (!source) {
        return
      }
      const name =
        pickString(source, ['bossNameZh', 'nameZh', 'name', 'bossName', 'label', 'title']) ??
        `${groupName.toUpperCase()}-${index + 1}`
      const secondaryName = pickString(source, ['bossName', 'nameEn'])
      const chance =
        source.spawnChance ?? source.rate ?? source.chance ?? source.refreshRate ?? source.value
      normalized.push({
        id: `${groupName}-${index}-${name}`,
        name,
        nameSecondary: secondaryName && secondaryName !== name ? secondaryName : undefined,
        chanceText: formatChance(chance),
      })
    })
    return normalized
  }

  const source = asRecord(group)
  if (!source) {
    return []
  }

  return Object.entries(source)
    .map(([name, value], index) => ({
      id: `${groupName}-${index}-${name}`,
      name,
      chanceText: formatChance(value),
    }))
    .filter((item) => item.name.trim().length > 0)
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

  const normalized: ExtractionIntelItem[] = []

  points.forEach((item, index) => {
    const source = asRecord(item)
    if (!source) {
      return
    }
    const detail = asRecord(source.detail) ?? {}
    const name = pickString(source, ['name', 'title', 'extractName', 'extractionName'])
    if (!name) {
      return
    }

    normalized.push({
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
        'isAlwaysAvailable',
        'permanent',
        'persistent',
      ]),
      oneTime: pickBoolean(detail, ['oneTime', 'isOneTime', 'singleUse', 'oneOff']),
      detailImageUrls: [
        ...pickNestedStringArray(detail, ['imageUrls', 'images']),
        ...pickNestedStringArray(source, ['imageUrls', 'images']),
      ].filter((value, valueIndex, list) => list.indexOf(value) === valueIndex),
      detailUrl: pickString(source, ['detailUrl', 'url']),
      description:
        pickString(source, ['description', 'details', 'desc']) ??
        pickString(detail, ['description', 'details', 'detail', 'desc']),
      location:
        pickString(source, ['location', 'area', 'region']) ??
        pickString(detail, ['location', 'area', 'region', 'mapName']),
      extraDetails: [
        ...collectExtraDetails(source, [
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
          'detail',
          'detailUrl',
          'url',
          'description',
          'details',
          'detail',
          'desc',
          'location',
          'area',
          'region',
          'imageUrls',
          'images',
        ]),
        ...collectExtraDetails(detail, [
          'mapName',
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
          'isAlwaysAvailable',
          'permanent',
          'persistent',
          'oneTime',
          'isOneTime',
          'singleUse',
          'oneOff',
          'description',
          'details',
          'detail',
          'desc',
          'location',
          'area',
          'region',
          'imageUrls',
          'images',
        ]),
      ].filter((item, itemIndex, list) => {
        return list.findIndex((candidate) => candidate.label === item.label && candidate.value === item.value) === itemIndex
      }),
    })
  })

  return normalized
}

const normalizeMapIntel = (payload: unknown): MapIntelResponse => {
  const source = asRecord(payload) ?? {}
  const bossRefresh = asRecord(source.bossRefresh) ?? {}
  const extractions = asRecord(source.extractions) ?? {}
  const errorMessage =
    pickString(source, ['errorMessage', 'message']) ??
    pickString(bossRefresh, ['errorMessage']) ??
    pickString(extractions, ['errorMessage'])

  return {
    errorMessage,
    mapNameZh: pickString(source, ['mapNameZh']),
    mapNameEn: pickString(source, ['mapNameEn']),
    bossRefresh: {
      regular: normalizeBossRefreshGroup(bossRefresh.regular, 'regular'),
      pve: normalizeBossRefreshGroup(bossRefresh.pve, 'pve'),
    },
    extractions: normalizeExtractions(source.extractions),
  }
}

const normalizeInstance = (payload: WhiteboardInstanceResponse): MapInstance => {
  return {
    id: payload.instanceId,
    createdAt: payload.createdAt,
    mapId: payload.mapId,
  }
}

export const createWhiteboardInstance = async (mapId: number): Promise<MapInstance> => {
  const response = await http.post<WhiteboardInstanceResponse>('/whiteboard/instances', { mapId })
  return normalizeInstance(response)
}

export const getWhiteboardInstance = async (instanceId: string): Promise<MapInstance> => {
  const response = await http.get<WhiteboardInstanceResponse>(`/whiteboard/instances/${instanceId}`)
  return normalizeInstance(response)
}

export const getWhiteboardState = async (instanceId: string): Promise<WhiteboardStateResponse> => {
  return http.get<WhiteboardStateResponse>(`/whiteboard/instances/${instanceId}/state`)
}

export const saveWhiteboardState = async (
  instanceId: string,
  state: unknown,
): Promise<WhiteboardStateResponse> => {
  return http.put<WhiteboardStateResponse>(`/whiteboard/instances/${instanceId}/state`, { state })
}

export const switchWhiteboardMap = async (
  instanceId: string,
  mapId: number,
  resetState = true,
): Promise<MapInstance> => {
  const response = await http.put<WhiteboardInstanceResponse>(
    `/whiteboard/instances/${instanceId}/map`,
    { mapId, resetState },
  )
  return normalizeInstance(response)
}

export const getWhiteboardMapIntel = async (instanceId: string): Promise<MapIntelResponse> => {
  const response = await http.get<unknown>(
    `/whiteboard/instances/${encodeURIComponent(instanceId)}/map-intel`,
  )
  return normalizeMapIntel(response)
}
