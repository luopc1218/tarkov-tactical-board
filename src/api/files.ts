const isNetworkImageSource = (value: string) => {
  const trimmed = value.trim()
  return /^(https?:)?\/\//i.test(trimmed) || /^\/(?!assets\/|src\/)/i.test(trimmed)
}

export const resolveImagePath = (value?: string | null) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  return isNetworkImageSource(trimmed) ? trimmed : undefined
}
