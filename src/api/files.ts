const localImageAssetMap = import.meta.glob('/src/assets/**/*.{png,jpg,jpeg,webp,gif,svg,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const localImageAssetEntries = Object.entries(localImageAssetMap)
const exactPathAliasMap: Record<string, string> = {
  'src/assets/images/tarkov-maps/Ground_Zero.png': '/src/assets/images/tarkov-maps/Ground Zero.png',
}

const normalizeAssetKey = (value: string) => {
  const normalizedRaw = value
    .trim()
    .replace(/\\/g, '/')
    .split(/[?#]/)[0]
    .replace(/^\.?\//, '')
  const normalized = (() => {
    try {
      return decodeURIComponent(normalizedRaw)
    } catch {
      return normalizedRaw
    }
  })()

  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('src/assets/')) {
    return `/${normalized}`
  }

  if (normalized.startsWith('assets/')) {
    return `/src/${normalized}`
  }

  if (normalized.startsWith('images/')) {
    return `/src/assets/${normalized}`
  }

  return ''
}

export const resolveImagePath = (value?: string | null) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedRaw = value.trim()
  const trimmed = (() => {
    try {
      return decodeURIComponent(trimmedRaw)
    } catch {
      return trimmedRaw
    }
  })()
  if (!trimmed) {
    return undefined
  }

  if (/^(https?:)?\/\//i.test(trimmed) || /^(data|blob):/i.test(trimmed)) {
    return trimmed
  }

  const normalizedAssetKey = normalizeAssetKey(trimmed)
  if (normalizedAssetKey && localImageAssetMap[normalizedAssetKey]) {
    return localImageAssetMap[normalizedAssetKey]
  }
  const aliasKey = normalizedAssetKey.replace(/^\/+/, '')
  const aliasTarget = exactPathAliasMap[aliasKey]
  if (aliasTarget && localImageAssetMap[aliasTarget]) {
    return localImageAssetMap[aliasTarget]
  }

  if (trimmed.startsWith('/assets/')) {
    const srcAssetKey = `/src${trimmed}`
    if (localImageAssetMap[srcAssetKey]) {
      return localImageAssetMap[srcAssetKey]
    }
  }

  const plainFileName = trimmed
    .replace(/\\/g, '/')
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean)
    .pop()
  if (plainFileName) {
    const matchedByName = localImageAssetEntries.find(([key]) => key.endsWith(`/${plainFileName}`))
    if (matchedByName) {
      return matchedByName[1]
    }
  }

  if (trimmed.startsWith('/')) {
    return trimmed
  }

  return `/${trimmed}`
}
