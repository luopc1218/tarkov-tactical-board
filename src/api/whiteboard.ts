import { http } from '../lib/http'
import type { MapInstance } from '../types/map-instance'

interface WhiteboardInstanceResponse {
  instanceId: string
  mapId: number
  wsPath: string
  createdAt?: string
}

export interface WhiteboardStateResponse {
  instanceId: string
  state: unknown
  updatedAt?: string
  expireAt?: string
}

const normalizeInstance = (payload: WhiteboardInstanceResponse): MapInstance => {
  return {
    id: payload.instanceId,
    wsPath: payload.wsPath,
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
