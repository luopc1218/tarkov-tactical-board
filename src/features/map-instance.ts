import type { MapInstance } from '../types/map-instance'

export const createMapInstance = (mapId: string): MapInstance => {
  const unique = Math.random().toString(36).slice(2, 8)

  return {
    id: `${mapId}-${Date.now()}-${unique}`,
    mapId,
    createdAt: Date.now(),
  }
}
