import { http } from '../lib/http'

export const uploadFile = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  return http.post<string>('/files/upload', formData)
}

export const buildFileDownloadUrl = (objectName: string) => {
  return `/api/files/download?objectName=${encodeURIComponent(objectName)}`
}
