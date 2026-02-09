import type { TarkovMapPreset } from '../constants/maps'
import { buildFileDownloadUrl } from './files'
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
  const rawName = readFirstNonEmptyString([
    item.nameZh,
    item.name_zh,
    item.zhName,
    item.cnName,
    item.name,
    item.mapName,
    item.map_name,
    item.displayName,
    item.display_name,
    item.label,
    item.title,
    item.nameEn,
    item.name_en,
    item.enName,
  ])

  const id = rawId ? toKebabCase(rawId) : ''
  const name = rawName || id
  const rawBannerUrl = item.bannerUrl ?? item.banner_url
  const rawBannerObjectName =
    item.bannerObjectName ?? item.banner_object_name ?? item.bannerPath ?? item.banner_path
  const bannerUrl =
    (typeof rawBannerUrl === 'string' && rawBannerUrl.trim()) ||
    (typeof rawBannerObjectName === 'string' && rawBannerObjectName.trim()
      ? buildFileDownloadUrl(rawBannerObjectName.trim())
      : undefined)

  if (!id || !name) {
    return null
  }

  return { id, name, bannerUrl }
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
            const bannerUrl =
              (typeof rawBannerUrl === 'string' && rawBannerUrl.trim()) ||
              (typeof rawBannerObjectName === 'string' && rawBannerObjectName.trim()
                ? buildFileDownloadUrl(rawBannerObjectName.trim())
                : undefined)

            const preset: TarkovMapPreset = {
              id: toKebabCase(firstString || `map-${index + 1}`),
              name: firstString.trim(),
            }

            if (bannerUrl) {
              preset.bannerUrl = bannerUrl
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
