export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  tokenType: string
  accessToken: string
  expireSeconds: number
}

export interface AdminMap {
  id: number
  code: string
  nameZh: string
  nameEn: string
  bannerPath: string
  bannerUrl: string
  mapPath: string
  mapUrl: string
}

export interface AdminMapUpsertRequest {
  code: string
  nameZh: string
  nameEn: string
  bannerPath: string
  mapPath: string
}

export interface AdminWhiteboardInstance {
  instanceId: string
  mapId: number
  createdAt: string
  updatedAt: string
  expireAt: string
  active: boolean
  hasState: boolean
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface ChangePasswordResponse {
  message?: string
}
