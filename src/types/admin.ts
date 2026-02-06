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
  bannerObjectName: string
  bannerUrl: string
  mapObjectName: string
  mapUrl: string
}

export interface AdminMapUpsertRequest {
  code: string
  nameZh: string
  nameEn: string
  bannerObjectName: string
  mapObjectName: string
}
