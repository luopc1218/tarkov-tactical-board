import type { TarkovMapPreset } from '../constants/maps'
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
  bannerFileName?: string
  banner_file_name?: string
  mapUrl?: string
  map_url?: string
  mapObjectName?: string
  map_object_name?: string
  mapPath?: string
  map_path?: string
  mapFileName?: string
  map_file_name?: string
  sortOrder?: string | number
  sort_order?: string | number
  order?: string | number
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

const isNetworkImageSource = (value: string) => {
  const trimmed = value.trim()
  return /^(https?:)?\/\//i.test(trimmed) || /^\/(?!assets\/|src\/)/i.test(trimmed)
}

const normalizeNetworkImageSource = (value: string) => {
  const trimmed = value.trim()
  return isNetworkImageSource(trimmed) ? trimmed : ''
}

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

  const id = readFirstFiniteNumber([item.id, item.mapId, item.map_id])
  const rawNameZh = readFirstNonEmptyString([item.nameZh, item.name_zh, item.zhName, item.cnName])
  const rawNameEn = readFirstNonEmptyString([item.nameEn, item.name_en, item.enName])
  const sortOrder = readFirstFiniteNumber([item.sortOrder, item.sort_order, item.order, item.id])
  const bannerImageSource = normalizeNetworkImageSource(
    readFirstNonEmptyString([
      item.bannerUrl,
      item.banner_url,
      item.bannerFileName,
      item.banner_file_name,
      item.bannerObjectName,
      item.banner_object_name,
      item.bannerPath,
      item.banner_path,
    ])
  )
  const mapImageSource = normalizeNetworkImageSource(
    readFirstNonEmptyString([
      item.mapUrl,
      item.map_url,
      item.mapFileName,
      item.map_file_name,
      item.mapObjectName,
      item.map_object_name,
      item.mapPath,
      item.map_path,
    ])
  )

  if (id === null || !rawNameZh || !rawNameEn || sortOrder === null) {
    return null
  }

  return {
    id,
    nameZh: rawNameZh,
    nameEn: rawNameEn,
    sortOrder,
    bannerFileName: bannerImageSource,
    mapFileName: mapImageSource,
  }
}

const readFallbackImageSource = (item: MapApiItem, keys: Array<keyof MapApiItem>) => {
  const imageSource = keys
    .map((key) => {
      const value = item[key]
      return typeof value === 'string' && value.trim() ? value.trim() : ''
    })
    .find((value) => normalizeNetworkImageSource(value))

  return imageSource ? normalizeNetworkImageSource(imageSource) : ''
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
          .map<TarkovMapPreset | null>((item) => {
            const firstString = Object.values(item).find(
              (value) => typeof value === 'string' && value.trim().length > 0
            ) as string | undefined
            if (!firstString) {
              return null
            }

            const id = Number(item.id ?? item.mapId ?? item.map_id)
            if (!Number.isFinite(id) || id <= 0) {
              return null
            }

            const nameZh =
              typeof item.nameZh === 'string' && item.nameZh.trim()
                ? item.nameZh.trim()
                : typeof item.name_zh === 'string' && item.name_zh.trim()
                  ? item.name_zh.trim()
                  : typeof item.zhName === 'string' && item.zhName.trim()
                    ? item.zhName.trim()
                    : ''
            const nameEn =
              typeof item.nameEn === 'string' && item.nameEn.trim()
                ? item.nameEn.trim()
                : typeof item.name_en === 'string' && item.name_en.trim()
                  ? item.name_en.trim()
                  : typeof item.enName === 'string' && item.enName.trim()
                    ? item.enName.trim()
                    : ''
            const sortOrder = Number(item.sortOrder ?? item.sort_order ?? item.order ?? id)
            if (!Number.isFinite(sortOrder)) {
              return null
            }

            const bannerImageSource = readFallbackImageSource(item, [
              'bannerUrl',
              'banner_url',
              'bannerFileName',
              'banner_file_name',
              'bannerObjectName',
              'banner_object_name',
              'bannerPath',
              'banner_path',
            ])
            const mapImageSource = readFallbackImageSource(item, [
              'mapUrl',
              'map_url',
              'mapFileName',
              'map_file_name',
              'mapObjectName',
              'map_object_name',
              'mapPath',
              'map_path',
            ])

            if (!nameZh || !nameEn) {
              return null
            }

            const preset: TarkovMapPreset = {
              id,
              nameZh,
              nameEn,
              sortOrder,
              bannerFileName: bannerImageSource,
              mapFileName: mapImageSource,
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
