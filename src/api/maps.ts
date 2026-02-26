import type { TarkovMapPreset } from '../constants/maps'
import { resolveImagePath } from './files'
import { http } from '../lib/http'

interface MapApiItem {
  id?: string | number
  mapId?: string | number
  key?: string | number
  slug?: string | number
  code?: string | number
  mapCode?: string | number
  map_code?: string | number
  map_id?: string | number
  value?: string | number
  name?: string
  mapName?: string
  map_name?: string
  nameZh?: string
  nameEn?: string
  name_zh?: string
  name_en?: string
  title?: string
  displayName?: string
  label?: string
  display_name?: string
  cnName?: string
  zhName?: string
  enName?: string
  bannerUrl?: string
  banner_url?: string
  bannerObjectName?: string
  banner_object_name?: string
  bannerPath?: string
  banner_path?: string
  mapUrl?: string
  map_url?: string
  mapObjectName?: string
  map_object_name?: string
  mapPath?: string
  map_path?: string
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
  const readFirstNonEmptyString = (values: Array<string | number | undefined>) => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
    return ''
  }
  const readFirstFiniteNumber = (values: Array<string | number | undefined>) => {
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
    return null
  }

  const rawId = readFirstNonEmptyString([
    item.code,
    item.mapCode,
    item.map_code,
    item.slug,
    item.key,
    item.value,
    item.mapId,
    item.map_id,
    item.id,
  ])
  const rawNameZh = readFirstNonEmptyString([item.nameZh, item.name_zh, item.zhName, item.cnName])
  const rawNameEn = readFirstNonEmptyString([item.nameEn, item.name_en, item.enName])
  const rawName = readFirstNonEmptyString([
    rawNameZh,
    rawNameEn,
    item.name,
    item.mapName,
    item.map_name,
    item.displayName,
    item.display_name,
    item.label,
    item.title,
  ])

  const id = rawId ? toKebabCase(rawId) : ''
  const mapId = readFirstFiniteNumber([item.id, item.mapId, item.map_id])
  const name = rawName || id
  const rawBannerUrl = item.bannerUrl ?? item.banner_url
  const rawBannerObjectName =
    item.bannerObjectName ?? item.banner_object_name ?? item.bannerPath ?? item.banner_path
  const bannerUrl = resolveImagePath(
    typeof rawBannerUrl === 'string' && rawBannerUrl.trim() ? rawBannerUrl : rawBannerObjectName,
  )
  const rawMapUrl = item.mapUrl ?? item.map_url
  const rawMapObjectName = item.mapObjectName ?? item.map_object_name ?? item.mapPath ?? item.map_path
  const mapUrl = resolveImagePath(
    typeof rawMapUrl === 'string' && rawMapUrl.trim() ? rawMapUrl : rawMapObjectName,
  )

  if (!id || !name || mapId === null) {
    return null
  }

  return {
    mapId,
    id,
    name,
    nameZh: rawNameZh || undefined,
    nameEn: rawNameEn || undefined,
    bannerUrl,
    mapUrl,
  }
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
          .map<TarkovMapPreset | null>((item, index) => {
            const firstString = Object.values(item).find(
              (value) => typeof value === 'string' && value.trim().length > 0,
            ) as string | undefined
            if (!firstString) {
              return null
            }

            const rawBannerObjectName =
              item.bannerObjectName ?? item.banner_object_name ?? item.bannerPath ?? item.banner_path
            const rawBannerUrl = item.bannerUrl ?? item.banner_url
            const bannerUrl = resolveImagePath(
              typeof rawBannerUrl === 'string' && rawBannerUrl.trim()
                ? rawBannerUrl
                : rawBannerObjectName,
            )
            const rawMapObjectName = item.mapObjectName ?? item.map_object_name ?? item.mapPath ?? item.map_path
            const rawMapUrl = item.mapUrl ?? item.map_url
            const mapUrl = resolveImagePath(
              typeof rawMapUrl === 'string' && rawMapUrl.trim() ? rawMapUrl : rawMapObjectName,
            )

            const fallbackMapId = Number(item.id ?? item.mapId ?? item.map_id)
            if (!Number.isFinite(fallbackMapId) || fallbackMapId <= 0) {
              return null
            }

            const fallbackNameZh =
              typeof item.nameZh === 'string' && item.nameZh.trim()
                ? item.nameZh.trim()
                : typeof item.name_zh === 'string' && item.name_zh.trim()
                  ? item.name_zh.trim()
                  : typeof item.zhName === 'string' && item.zhName.trim()
                    ? item.zhName.trim()
                    : undefined
            const fallbackNameEn =
              typeof item.nameEn === 'string' && item.nameEn.trim()
                ? item.nameEn.trim()
                : typeof item.name_en === 'string' && item.name_en.trim()
                  ? item.name_en.trim()
                  : typeof item.enName === 'string' && item.enName.trim()
                    ? item.enName.trim()
                    : undefined

            const preset: TarkovMapPreset = {
              mapId: fallbackMapId,
              id: toKebabCase(firstString || `map-${index + 1}`),
              name: firstString.trim(),
              nameZh: fallbackNameZh,
              nameEn: fallbackNameEn,
            }

            if (bannerUrl) {
              preset.bannerUrl = bannerUrl
            }
            if (mapUrl) {
              preset.mapUrl = mapUrl
            }

            return preset
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

  return mapPresetsInFlight!
}

export const refreshMapPresets = async (): Promise<TarkovMapPreset[]> => {
  mapPresetsCache = null
  return fetchMapPresets()
}
