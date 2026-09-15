const RECENT_INSTANCES_STORAGE_KEY = 'tarkov_tactical_board_recent_instances'
const MAX_RECENT_INSTANCES = 5

export interface RecentInstanceRecord {
  instanceId: string
  mapName: string
  createdAt: string
}

const isValidRecentInstanceRecord = (value: unknown): value is RecentInstanceRecord => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<RecentInstanceRecord>
  return (
    typeof record.instanceId === 'string' &&
    record.instanceId.trim().length > 0 &&
    typeof record.mapName === 'string' &&
    record.mapName.trim().length > 0 &&
    typeof record.createdAt === 'string' &&
    record.createdAt.trim().length > 0
  )
}

const readRecentInstances = (): RecentInstanceRecord[] => {
  const raw = localStorage.getItem(RECENT_INSTANCES_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isValidRecentInstanceRecord).slice(0, MAX_RECENT_INSTANCES)
  } catch {
    localStorage.removeItem(RECENT_INSTANCES_STORAGE_KEY)
    return []
  }
}

const writeRecentInstances = (records: RecentInstanceRecord[]) => {
  try {
    localStorage.setItem(
      RECENT_INSTANCES_STORAGE_KEY,
      JSON.stringify(records.slice(0, MAX_RECENT_INSTANCES)),
    )
  } catch (error) {
    console.warn('[recent-instances] Failed to persist records', error)
  }
}

export const getRecentInstances = () => {
  return readRecentInstances()
}

export const saveRecentInstance = (payload: { instanceId: string; mapName: string }) => {
  const instanceId = payload.instanceId.trim()
  const mapName = payload.mapName.trim()
  if (!instanceId || !mapName) {
    return
  }

  const nextRecord: RecentInstanceRecord = {
    instanceId,
    mapName,
    createdAt: new Date().toISOString(),
  }

  const existing = readRecentInstances()
  const deduped = existing.filter((item) => item.instanceId !== instanceId)
  writeRecentInstances([nextRecord, ...deduped])
}
