import { http } from '../lib/http'
import type { AdminWhiteboardInstance } from '../types/admin'

export const listAdminWhiteboardInstances = (includeExpired = true) => {
  return http.get<AdminWhiteboardInstance[]>('/admin/whiteboard/instances', {
    params: { includeExpired },
  })
}

export const deleteAdminWhiteboardInstance = (instanceId: string) => {
  return http.delete<void>(`/admin/whiteboard/instances/${encodeURIComponent(instanceId)}`)
}
