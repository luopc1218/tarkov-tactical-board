import { isTauri } from '@tauri-apps/api/core'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export const isUpdaterSupported = () => isTauri()

export const checkForUpdate = async (): Promise<Update | null> => {
  if (!isUpdaterSupported()) {
    return null
  }

  return check()
}

export const installUpdate = async (
  update: Update,
  onProgress?: (percent: number | null) => void,
) => {
  let totalBytes = 0
  let downloadedBytes = 0

  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      totalBytes = event.data.contentLength ?? 0
      onProgress?.(totalBytes > 0 ? 0 : null)
    } else if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength
      onProgress?.(
        totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null,
      )
    } else if (event.event === 'Finished') {
      onProgress?.(100)
    }
  })

  await relaunch()
}
