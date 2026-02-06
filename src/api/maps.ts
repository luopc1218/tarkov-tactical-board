import type { TarkovMapPreset } from '../constants/maps'
import { http } from '../lib/http'

interface MapApiItem {
  id?: string
  mapId?: string
  key?: string
  slug?: string
  code?: string
  mapCode?: string
  map_code?: string
  map_id?: string
  value?: string
  name?: string
  mapName?: string
  map_name?: string
  title?: string
  displayName?: string
  label?: string
  display_name?: string
  cnName?: string
  zhName?: string
  enName?: string
}

interface MapApiContainer {
  maps?: MapApiItem[]
  list?: MapApiItem[]
  items?: MapApiItem[]
  records?: MapApiItem[]
  mapList?: MapApiItem[]
  result?: MapApiItem[]
  rows?: MapApiItem[]
}

let mapPresetsCache: TarkovMapPreset[] | null = null
let mapPresetsInFlight: Promise<TarkovMapPreset[]> | null = null

const toKebabCase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const extractMapItems = (payload: unknown): MapApiItem[] => {
  if (Array.isArray(payload)) {
    return payload as MapApiItem[]
  }

  if (payload && typeof payload === 'object') {
    const container = payload as MapApiContainer
    const direct =
      container.maps ??
      container.list ??
      container.items ??
      container.records ??
      container.mapList ??
      container.result ??
      container.rows

    if (direct) {
      return direct
    }

    // Fallback: scan one level deep for the first array value.
    const values = Object.values(container) as unknown[]
    for (const value of values) {
      if (Array.isArray(value)) {
        return value as MapApiItem[]
      }
      if (value && typeof value === 'object') {
        const nestedValues = Object.values(value as Record<string, unknown>)
        const nestedArray = nestedValues.find((nested) => Array.isArray(nested))
        if (nestedArray) {
          return nestedArray as MapApiItem[]
        }
      }
    }
  }

  return []
}

const normalizeMapPreset = (item: MapApiItem): TarkovMapPreset | null => {
  const rawId =
    item.id ??
    item.mapId ??
    item.map_id ??
    item.key ??
    item.slug ??
    item.code ??
    item.mapCode ??
    item.map_code ??
    item.value
  const rawName =
    item.name ??
    item.mapName ??
    item.map_name ??
    item.title ??
    item.displayName ??
    item.display_name ??
    item.label ??
    item.cnName ??
    item.zhName ??
    item.enName

  const id = typeof rawId === 'string' && rawId.trim() ? toKebabCase(rawId) : ''
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : id

  if (!id || !name) {
    return null
  }

  return { id, name }
}

export const fetchMapPresets = async (): Promise<TarkovMapPreset[]> => {
  if (mapPresetsCache) {
    return mapPresetsCache
  }

  if (mapPresetsInFlight) {
    return mapPresetsInFlight
  }

  mapPresetsInFlight = http
    .get<unknown>('/maps')
    .then((response) => {
      const mapItems = extractMapItems(response)
      const normalized = mapItems
        .map(normalizeMapPreset)
        .filter((item): item is TarkovMapPreset => item !== null)

      // If backend returns objects but unknown keys, keep readable fallback to avoid blank UI.
      if (normalized.length === 0 && mapItems.length > 0) {
        const fallback = mapItems
          .map((item, index) => {
            const firstString = Object.values(item).find(
              (value) => typeof value === 'string' && value.trim().length > 0,
            ) as string | undefined
            if (!firstString) {
              return null
            }

            return {
              id: toKebabCase(firstString || `map-${index + 1}`),
              name: firstString.trim(),
            }
          })
          .filter((item): item is TarkovMapPreset => item !== null)

        mapPresetsCache = fallback
        return fallback
      }

      mapPresetsCache = normalized
      return normalized
    })
    .finally(() => {
      mapPresetsInFlight = null
    })

  return mapPresetsInFlight
}

export const refreshMapPresets = async (): Promise<TarkovMapPreset[]> => {
  mapPresetsCache = null
  return fetchMapPresets()
}
