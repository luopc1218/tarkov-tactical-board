import type { MapInstance } from '../types/map-instance'

export const createMapInstance = (mapId: number): MapInstance => {
  const unique = Math.random().toString(36).slice(2, 8)

  return {
    id: `${mapId}-${Date.now()}-${unique}`,
    mapId,
    wsPath: '',
    createdAt: new Date().toISOString(),
  }
}
