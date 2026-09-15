export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  tokenType: string
  accessToken: string
  expireSeconds: number
}

export interface AdminWhiteboardInstance {
  instanceId: string
  mapId?: number
  createdAt: string
  updatedAt: string
  expireAt: string
  active: boolean
  hasState: boolean
}

export interface AdminWhiteboardInstancePage {
  items: AdminWhiteboardInstance[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface ChangePasswordResponse {
  message?: string
}
