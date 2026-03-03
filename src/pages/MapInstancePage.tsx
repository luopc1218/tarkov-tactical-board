import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiCopy, FiMessageSquare, FiSend } from 'react-icons/fi'
import type { TarkovMapPreset } from '../constants/maps'
import { fetchMapPresets } from '../api/maps'
import {
  getWhiteboardInstance,
  getWhiteboardState,
  saveWhiteboardState,
  switchWhiteboardMap,
} from '../api/whiteboard'
import { saveRecentInstance } from '../features/recent-instances'
import { getApiBaseUrl } from '../lib/runtime-config'
import type { MapInstance } from '../types/map-instance'

interface MapInstancePageProps {
  instanceId: string | null
  onBackHome: () => void
}

interface Point {
  x: number
  y: number
}

interface Stroke {
  id: string
  points: Point[]
  color: string
  width: number
}

interface Viewport {
  x: number
  y: number
  scale: number
}

interface LocalPoint {
  x: number
  y: number
}

interface RemoteCursor {
  clientId: string
  x: number
  y: number
  label: string
  color: string
  updatedAt: number
}

interface ChatMessage {
  id: string
  clientId: string
  text: string
  displayName: string
  sentAt: number
  isLocal: boolean
  failed?: boolean
}

const DEFAULT_CANVAS_WIDTH = 1920
const DEFAULT_CANVAS_HEIGHT = 1080
const MIN_SCALE = 0.05
const MAX_SCALE = 8
const WHITEBOARD_STROKE_START_TOPIC = 'stroke.start'
const WHITEBOARD_STROKE_APPEND_TOPIC = 'stroke.append'
const WHITEBOARD_STROKE_END_TOPIC = 'stroke.end'
const WHITEBOARD_CLEAR_TOPIC = 'board.clear'
const WHITEBOARD_UNDO_TOPIC = 'stroke.undo'
const WHITEBOARD_CURSOR_MOVE_TOPIC = 'cursor.move'
const WHITEBOARD_CURSOR_LEAVE_TOPIC = 'cursor.leave'
const WHITEBOARD_MAP_CHANGED_TOPIC = 'map.changed'
const CHAT_MESSAGE_TOPIC = 'chat.message'
const CHAT_HISTORY_TOPIC = 'chat.history'
const STROKE_APPEND_INTERVAL_MS = 40
const WS_RECONNECT_BACKOFF_MS = [1000, 2000, 5000]
const CHAT_MAX_MESSAGES = 200
const CHAT_MESSAGE_TOPIC_ALIASES = new Set([
  CHAT_MESSAGE_TOPIC,
  'chat.send',
  'chat.broadcast',
  'chat.receive',
  'chat.push',
])
const CHAT_HISTORY_TOPIC_ALIASES = new Set([
  CHAT_HISTORY_TOPIC,
  'chat.sync',
  'chat.messages',
  'chat.init',
])

const buildPathData = (points: Point[]) => {
  if (points.length === 0) {
    return ''
  }
  if (points.length === 1) {
    const { x, y } = points[0]
    return `M ${x} ${y}`
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const distanceBetween = (a: LocalPoint, b: LocalPoint) => Math.hypot(a.x - b.x, a.y - b.y)
const midpointBetween = (a: LocalPoint, b: LocalPoint): LocalPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

const colorFromId = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 90% 62%)`
}

const resolveWsUrl = (wsPath: string) => {
  const normalizedWsPath = wsPath.startsWith('/') ? wsPath : `/${wsPath}`

  if (/^wss?:\/\//i.test(wsPath)) {
    return wsPath
  }

  if (/^https?:\/\//i.test(wsPath)) {
    return wsPath.replace(/^http/i, 'ws')
  }

  const tryBuildWsFromHttpBase = (baseValue: string) => {
    try {
      const base = new URL(baseValue)
      const protocol = base.protocol === 'https:' || base.protocol === 'wss:' ? 'wss:' : 'ws:'
      return new URL(normalizedWsPath, `${protocol}//${base.host}`).toString()
    } catch {
      return null
    }
  }

  const wsBase = import.meta.env.VITE_WS_BASE_URL?.trim() ?? ''
  const apiBase = getApiBaseUrl().trim()
  const candidates = [
    wsBase,
    apiBase,
    window.location.origin,
    // Electron packaged app commonly loads from file://, fallback to local backend default.
    'http://127.0.0.1:8080',
  ]

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }
    const built = tryBuildWsFromHttpBase(candidate)
    if (built) {
      return built
    }
  }

  return null
}

const buildChatWsPath = (instanceId: string) => `/ws/chat/${encodeURIComponent(instanceId)}`

const createRealtimeClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `c-${crypto.randomUUID()}`
  }
  return `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

const createChatSenderName = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `U-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
  }
  return `U-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`
}

const readStrokePayload = (payload: unknown): Stroke | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const source = payload as Partial<Stroke>
  if (!source.id || !Array.isArray(source.points) || source.points.length === 0) {
    return null
  }

  const points = source.points
    .map((point) => {
      if (!point || typeof point !== 'object') {
        return null
      }
      const x = Number((point as Point).x)
      const y = Number((point as Point).y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
      }
      return { x, y }
    })
    .filter((point): point is Point => point !== null)

  if (points.length === 0) {
    return null
  }

  return {
    id: source.id,
    points,
    color: source.color || '#22d3ee',
    width: Number.isFinite(source.width) ? Number(source.width) : 3,
  }
}

const readStrokesFromState = (state: unknown): Stroke[] => {
  const strokeList = Array.isArray(state)
    ? state
    : state &&
        typeof state === 'object' &&
        Array.isArray((state as Record<string, unknown>).strokes)
      ? ((state as Record<string, unknown>).strokes as unknown[])
      : []

  return strokeList
    .map((item) => readStrokePayload(item))
    .filter((item): item is Stroke => item !== null)
}

const readCursorPayload = (payload: unknown): RemoteCursor | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const source = payload as {
    clientId?: unknown
    x?: unknown
    y?: unknown
    label?: unknown
    color?: unknown
  }
  const clientId = typeof source.clientId === 'string' ? source.clientId.trim() : ''
  const x = Number(source.x)
  const y = Number(source.y)
  if (!clientId || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }

  return {
    clientId,
    x,
    y,
    label:
      typeof source.label === 'string' && source.label.trim()
        ? source.label.trim()
        : `User-${clientId.slice(0, 4)}`,
    color:
      typeof source.color === 'string' && source.color.trim()
        ? source.color.trim()
        : colorFromId(clientId),
    updatedAt: Date.now(),
  }
}

const readUndoPayload = (payload: unknown): { strokeId: string; clientId?: string } | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const source = payload as { strokeId?: unknown; clientId?: unknown }
  const strokeId = typeof source.strokeId === 'string' ? source.strokeId.trim() : ''
  if (!strokeId) {
    return null
  }
  return {
    strokeId,
    clientId: typeof source.clientId === 'string' ? source.clientId : undefined,
  }
}

const readStrokeStreamPayload = (
  payload: unknown
): {
  strokeId: string
  clientId?: string
  point?: Point
  points?: Point[]
  color?: string
  width?: number
} | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const source = payload as Record<string, unknown>
  const strokeId = typeof source.strokeId === 'string' ? source.strokeId.trim() : ''
  if (!strokeId) {
    return null
  }

  const parsePoint = (value: unknown): Point | null => {
    if (!value || typeof value !== 'object') {
      return null
    }
    const x = Number((value as Record<string, unknown>).x)
    const y = Number((value as Record<string, unknown>).y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }
    return { x, y }
  }

  const point = parsePoint(source.point)
  const points = Array.isArray(source.points)
    ? source.points.map(parsePoint).filter((item): item is Point => item !== null)
    : undefined
  const widthRaw = Number(source.width)

  return {
    strokeId,
    clientId: typeof source.clientId === 'string' ? source.clientId : undefined,
    point: point ?? undefined,
    points: points && points.length > 0 ? points : undefined,
    color: typeof source.color === 'string' ? source.color : undefined,
    width: Number.isFinite(widthRaw) ? widthRaw : undefined,
  }
}

const readMapChangedPayload = (
  payload: unknown
): { mapId: number; resetState: boolean } | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const source = payload as Record<string, unknown>
  const rawMapId = Number(source.mapId ?? source.map_id)
  if (!Number.isFinite(rawMapId) || rawMapId <= 0) {
    return null
  }

  return {
    mapId: rawMapId,
    resetState: source.resetState === undefined ? true : Boolean(source.resetState),
  }
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const readIdentifier = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  return readString(value)
}

const pickString = (source: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = readString(source[key])
    if (value) {
      return value
    }
  }
  return null
}

const pickIdentifier = (source: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = readIdentifier(source[key])
    if (value) {
      return value
    }
  }
  return null
}

const resolveEventType = (source: Record<string, unknown>) => {
  return (
    pickString(source, ['type', 'topic', 'event', 'action', 'name']) ??
    (source.payload && typeof source.payload === 'object'
      ? pickString(source.payload as Record<string, unknown>, ['type', 'topic', 'event', 'action'])
      : null) ??
    (source.data && typeof source.data === 'object'
      ? pickString(source.data as Record<string, unknown>, ['type', 'topic', 'event', 'action'])
      : null) ??
    ''
  ).toLowerCase()
}

const parseChatTimestamp = (source: Record<string, unknown>) => {
  const timestampCandidates = [source.sentAt, source.timestamp, source.createdAt, source.time]
  for (const candidate of timestampCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Date.parse(candidate)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return Date.now()
}

const normalizeChatMessage = (payload: unknown): Omit<ChatMessage, 'isLocal' | 'failed'> | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const source = payload as Record<string, unknown>
  const text = pickString(source, ['text', 'message', 'content', 'msg'])
  if (!text) {
    return null
  }

  const explicitClientId = pickString(source, ['clientId', 'senderId', 'userId', 'from'])
  const displayName =
    pickString(source, ['displayName', 'senderName', 'nickname', 'username', 'name']) ??
    (explicitClientId ? `User-${explicitClientId.slice(0, 4).toUpperCase()}` : 'User')
  const clientId =
    explicitClientId ?? `name:${displayName}`
  const sentAt = parseChatTimestamp(source)
  const id =
    pickIdentifier(source, ['messageId', 'id', 'clientMessageId']) ??
    `${clientId}-${sentAt}-${text.slice(0, 16)}`

  return {
    id,
    clientId,
    text,
    displayName,
    sentAt,
  }
}

const readChatMessagesPayload = (payload: unknown): Omit<ChatMessage, 'isLocal' | 'failed'>[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => normalizeChatMessage(item))
      .filter((item): item is Omit<ChatMessage, 'isLocal' | 'failed'> => item !== null)
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const source = payload as Record<string, unknown>
  const listKeys = ['messages', 'items', 'list', 'history', 'records']
  for (const key of listKeys) {
    const value = source[key]
    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeChatMessage(item))
        .filter((item): item is Omit<ChatMessage, 'isLocal' | 'failed'> => item !== null)
    }
  }

  const objectKeys = ['message', 'item', 'record']
  for (const key of objectKeys) {
    const value = source[key]
    const normalized = normalizeChatMessage(value)
    if (normalized) {
      return [normalized]
    }
  }

  const single = normalizeChatMessage(payload)
  return single ? [single] : []
}

const isLocalChatMessage = (
  message: Omit<ChatMessage, 'isLocal' | 'failed'>,
  localClientId: string,
  localDisplayName: string
) => {
  if (message.clientId === localClientId) {
    return true
  }
  return message.displayName.trim().toLowerCase() === localDisplayName.trim().toLowerCase()
}

const copyText = async (value: string): Promise<boolean> => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fallback below.
    }
  }

  try {
    const textArea = document.createElement('textarea')
    textArea.value = value
    textArea.setAttribute('readonly', 'true')
    textArea.style.position = 'fixed'
    textArea.style.top = '-9999px'
    textArea.style.left = '-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textArea)
    return copied
  } catch {
    return false
  }
}

export function MapInstancePage({ instanceId, onBackHome }: MapInstancePageProps) {
  const { t, i18n } = useTranslation()
  const isZhLanguage = (i18n.resolvedLanguage ?? i18n.language ?? '').startsWith('zh')
  const [instance, setInstance] = useState<MapInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapPresets, setMapPresets] = useState<TarkovMapPreset[]>([])
  const [switchingMap, setSwitchingMap] = useState(false)
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null)
  const [mapUrl, setMapUrl] = useState<string | undefined>(undefined)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [wsConnected, setWsConnected] = useState(false)
  const [chatWsConnected, setChatWsConnected] = useState(false)
  const [contentSize, setContentSize] = useState({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  })
  const [brushColor, setBrushColor] = useState('#ff3b30')
  const [brushWidth, setBrushWidth] = useState(16)
  const [cursorScale, setCursorScale] = useState(1.8)
  const [copied, setCopied] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [chatVisible, setChatVisible] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatUnread, setChatUnread] = useState(0)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({})
  const [remoteInProgressStrokes, setRemoteInProgressStrokes] = useState<Record<string, Stroke>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const chatWsRef = useRef<WebSocket | null>(null)
  const localStrokeIdsRef = useRef(new Set<string>())
  const chatMessageIdsRef = useRef(new Set<string>())
  const chatVisibleRef = useRef(false)
  const localClientIdRef = useRef(createRealtimeClientId())
  const localDisplayNameRef = useRef(createChatSenderName())
  const lastCursorSentAtRef = useRef(0)
  const pointerModeRef = useRef<'draw' | 'pan' | 'pinch' | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const panAnchorRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const activeTouchPointsRef = useRef<Map<number, LocalPoint>>(new Map())
  const pinchRef = useRef<{
    worldX: number
    worldY: number
    startDistance: number
    startScale: number
  } | null>(null)
  const stateHydratedRef = useRef(false)
  const currentStrokeRef = useRef<Stroke | null>(null)
  const pendingAppendPointsRef = useRef<Point[]>([])
  const appendTimerRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const chatReconnectTimerRef = useRef<number | null>(null)
  const chatReconnectAttemptRef = useRef(0)

  useEffect(() => {
    currentStrokeRef.current = currentStroke
  }, [currentStroke])

  useEffect(() => {
    chatVisibleRef.current = chatVisible
  }, [chatVisible])

  useEffect(() => {
    if (!chatVisible) {
      return
    }

    const timer = window.setTimeout(() => {
      const container = chatScrollRef.current
      if (!container) {
        return
      }
      container.scrollTop = container.scrollHeight
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [chatMessages, chatVisible])

  useEffect(() => {
    queueMicrotask(() => {
      setChatVisible(false)
      setChatInput('')
      setChatUnread(0)
      setChatMessages([])
    })
    chatMessageIdsRef.current.clear()
    if (instanceId) {
      localDisplayNameRef.current = createChatSenderName()
    }
  }, [instanceId])

  const appendChatMessages = useCallback(
    (messages: ChatMessage[], options?: { countUnread?: boolean }) => {
      const countUnread = options?.countUnread ?? true
      if (messages.length === 0) {
        return
      }

      const nextItems: ChatMessage[] = []
      for (const message of messages) {
        if (!message.id || chatMessageIdsRef.current.has(message.id)) {
          continue
        }
        chatMessageIdsRef.current.add(message.id)
        nextItems.push(message)
      }

      if (nextItems.length === 0) {
        return
      }

      setChatMessages((prev) => [...prev, ...nextItems].slice(-CHAT_MAX_MESSAGES))

      if (countUnread && !chatVisibleRef.current) {
        const unreadDelta = nextItems.reduce((count, item) => count + (item.isLocal ? 0 : 1), 0)
        if (unreadDelta > 0) {
          setChatUnread((prev) => prev + unreadDelta)
        }
      }
    },
    []
  )

  const toggleChatVisibility = () => {
    setMobileDrawerOpen(false)
    const nextVisible = !chatVisibleRef.current
    if (nextVisible) {
      setChatUnread(0)
    }
    setChatVisible(nextVisible)
  }

  const formatChatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderConnectionBadge = (label: string, connected: boolean) => (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium',
        connected
          ? 'border-emerald-300/45 bg-emerald-500/12 text-emerald-100'
          : 'border-rose-300/45 bg-rose-500/12 text-rose-100',
      ].join(' ')}
    >
      <span>{label}</span>
      <span>{connected ? t('mapInstance.connected') : t('mapInstance.disconnected')}</span>
    </span>
  )

  const resolveMapLabel = useCallback(
    (mapId: number | null | undefined) => {
      if (!mapId) {
        return '-'
      }
      const matched = mapPresets.find((item) => item.mapId === mapId)
      if (!matched) {
        return String(mapId)
      }
      if (isZhLanguage) {
        return matched.nameZh || matched.nameEn || matched.name
      }
      return matched.nameEn || matched.nameZh || matched.name
    },
    [isZhLanguage, mapPresets]
  )

  useEffect(() => {
    if (!instance?.id || !instance?.mapId) {
      return
    }

    saveRecentInstance({
      instanceId: instance.id,
      mapName: resolveMapLabel(instance.mapId),
    })
  }, [instance?.id, instance?.mapId, resolveMapLabel])

  const handleSwitchMap = useCallback(() => {
    if (!instance?.id || !selectedMapId || switchingMap) {
      return
    }
    if (instance.mapId === selectedMapId) {
      return
    }

    setSwitchingMap(true)
    void switchWhiteboardMap(instance.id, selectedMapId, true)
      .then((nextInstance) => {
        setInstance((prev) => (prev ? { ...prev, mapId: nextInstance.mapId } : nextInstance))
        setSelectedMapId(nextInstance.mapId ?? null)
        setStrokes([])
        setCurrentStroke(null)
        setRemoteInProgressStrokes({})
        localStrokeIdsRef.current.clear()
      })
      .catch((error) => {
        console.warn('[MapInstancePage] Switch map failed', {
          instanceId: instance.id,
          targetMapId: selectedMapId,
          error,
        })
      })
      .finally(() => {
        setSwitchingMap(false)
      })
  }, [instance, selectedMapId, switchingMap])

  useEffect(() => {
    if (!instanceId) {
      queueMicrotask(() => {
        setInstance(null)
        setLoading(false)
      })
      return
    }

    let active = true
    queueMicrotask(() => {
      setLoading(true)
    })
    void getWhiteboardInstance(instanceId)
      .then((payload) => {
        if (!active) {
          return
        }
        setInstance(payload)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setInstance(null)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [instanceId])

  const currentMapId = instance?.mapId ?? null

  useEffect(() => {
    if (!instance?.id) {
      queueMicrotask(() => {
        setMapPresets([])
        setMapUrl(undefined)
      })
      return
    }

    let active = true
    void fetchMapPresets()
      .then((presets) => {
        if (!active) {
          return
        }
        setMapPresets(presets)
        const matched = presets.find((item) => item.mapId === currentMapId)
        setMapUrl(matched?.mapUrl)
      })
      .catch(() => {
        if (active) {
          setMapPresets([])
          setMapUrl(undefined)
        }
      })

    return () => {
      active = false
    }
  }, [instance?.id, currentMapId])

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedMapId(instance?.mapId ?? null)
    })
  }, [instance?.mapId])

  useEffect(() => {
    if (!instance?.wsPath) {
      return
    }

    const resolvedWsUrl = resolveWsUrl(instance.wsPath)
    if (!resolvedWsUrl) {
      console.warn('[MapInstancePage] Unable to resolve websocket url', {
        wsPath: instance.wsPath,
        apiBaseUrl: getApiBaseUrl(),
      })
      return
    }

    let destroyed = false
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const connect = () => {
      let ws: WebSocket
      try {
        ws = new WebSocket(resolvedWsUrl)
      } catch {
        return
      }

      wsRef.current = ws
      queueMicrotask(() => {
        setWsConnected(false)
      })

      ws.onopen = () => {
        reconnectAttemptRef.current = 0
        clearReconnectTimer()
        setWsConnected(true)
      }
      ws.onclose = (event) => {
        setWsConnected(false)
        if (wsRef.current === ws) {
          wsRef.current = null
        }
        console.warn('[MapInstancePage] WebSocket closed', {
          wsPath: instance.wsPath,
          resolvedWsUrl,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        })
        if (destroyed) {
          return
        }
        const retryDelay =
          WS_RECONNECT_BACKOFF_MS[
            Math.min(reconnectAttemptRef.current, WS_RECONNECT_BACKOFF_MS.length - 1)
          ]
        reconnectAttemptRef.current += 1
        clearReconnectTimer()
        reconnectTimerRef.current = window.setTimeout(() => {
          connect()
        }, retryDelay)
      }
      ws.onerror = () => {
        setWsConnected(false)
        console.warn('[MapInstancePage] WebSocket connection error', {
          wsPath: instance.wsPath,
          resolvedWsUrl,
        })
      }
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type?: string
            payload?: unknown
            data?: unknown
          }
          const type = resolveEventType(payload as unknown as Record<string, unknown>)
          const actualPayload = payload.payload ?? payload.data ?? payload

          if (type === WHITEBOARD_MAP_CHANGED_TOPIC) {
            const changed = readMapChangedPayload(actualPayload)
            if (!changed) {
              return
            }
            setInstance((prev) => (prev ? { ...prev, mapId: changed.mapId } : prev))
            setSelectedMapId(changed.mapId)
            if (changed.resetState) {
              setStrokes([])
              setCurrentStroke(null)
              setRemoteInProgressStrokes({})
              localStrokeIdsRef.current.clear()
            }
            return
          }

          if (type === WHITEBOARD_CURSOR_LEAVE_TOPIC) {
            const leave = readCursorPayload(actualPayload)
            if (!leave || leave.clientId === localClientIdRef.current) {
              return
            }
            setRemoteCursors((prev) => {
              const next = { ...prev }
              delete next[leave.clientId]
              return next
            })
            return
          }

          if (type === WHITEBOARD_CURSOR_MOVE_TOPIC) {
            const cursor = readCursorPayload(actualPayload)
            if (!cursor || cursor.clientId === localClientIdRef.current) {
              return
            }
            setRemoteCursors((prev) => ({ ...prev, [cursor.clientId]: cursor }))
            return
          }

          if (type === WHITEBOARD_STROKE_START_TOPIC) {
            const stream = readStrokeStreamPayload(actualPayload)
            if (!stream || stream.clientId === localClientIdRef.current) {
              return
            }
            const firstPoint = stream.point ?? stream.points?.[0]
            if (!firstPoint) {
              return
            }
            setRemoteInProgressStrokes((prev) => ({
              ...prev,
              [stream.strokeId]: {
                id: stream.strokeId,
                points: [firstPoint],
                color: stream.color || '#22d3ee',
                width: stream.width || 3,
              },
            }))
            return
          }

          if (type === WHITEBOARD_STROKE_APPEND_TOPIC) {
            const stream = readStrokeStreamPayload(actualPayload)
            if (!stream || stream.clientId === localClientIdRef.current) {
              return
            }
            const nextPoints = stream.points ?? (stream.point ? [stream.point] : [])
            if (nextPoints.length === 0) {
              return
            }
            setRemoteInProgressStrokes((prev) => {
              const target = prev[stream.strokeId]
              if (!target) {
                return {
                  ...prev,
                  [stream.strokeId]: {
                    id: stream.strokeId,
                    points: nextPoints,
                    color: stream.color || '#22d3ee',
                    width: stream.width || 3,
                  },
                }
              }
              return {
                ...prev,
                [stream.strokeId]: {
                  ...target,
                  points: [...target.points, ...nextPoints],
                },
              }
            })
            return
          }

          if (type === WHITEBOARD_STROKE_END_TOPIC) {
            const stream = readStrokeStreamPayload(actualPayload)
            if (!stream || stream.clientId === localClientIdRef.current) {
              return
            }
            setRemoteInProgressStrokes((prev) => {
              const target = prev[stream.strokeId]
              if (!target) {
                return prev
              }
              setStrokes((current) =>
                current.some((item) => item.id === target.id) ? current : [...current, target]
              )
              const next = { ...prev }
              delete next[stream.strokeId]
              return next
            })
            return
          }

          if (type === WHITEBOARD_UNDO_TOPIC) {
            const undo = readUndoPayload(actualPayload)
            if (!undo || undo.clientId === localClientIdRef.current) {
              return
            }
            setStrokes((prev) => prev.filter((item) => item.id !== undo.strokeId))
            localStrokeIdsRef.current.delete(undo.strokeId)
            return
          }

          if (type === WHITEBOARD_CLEAR_TOPIC) {
            setStrokes([])
            setCurrentStroke(null)
            setRemoteInProgressStrokes({})
            localStrokeIdsRef.current.clear()
            return
          }
          const remoteStroke = readStrokePayload(actualPayload)
          if (!remoteStroke || localStrokeIdsRef.current.has(remoteStroke.id)) {
            return
          }
          setRemoteInProgressStrokes((prev) => {
            if (!prev[remoteStroke.id]) {
              return prev
            }
            const next = { ...prev }
            delete next[remoteStroke.id]
            return next
          })
          setStrokes((prev) =>
            prev.some((item) => item.id === remoteStroke.id) ? prev : [...prev, remoteStroke]
          )
        } catch {
          // Ignore non-JSON messages.
        }
      }
    }

    reconnectAttemptRef.current = 0
    clearReconnectTimer()
    connect()

    return () => {
      destroyed = true
      clearReconnectTimer()
      const ws = wsRef.current
      if (ws) {
        ws.close()
      }
      wsRef.current = null
      setWsConnected(false)
      setRemoteCursors({})
      setRemoteInProgressStrokes({})
    }
  }, [instance?.wsPath])

  useEffect(() => {
    if (!instance?.id) {
      return
    }

    const chatWsPath = buildChatWsPath(instance.id)
    const resolvedChatWsUrl = resolveWsUrl(chatWsPath)
    if (!resolvedChatWsUrl) {
      console.warn('[MapInstancePage] Unable to resolve chat websocket url', {
        chatWsPath,
        apiBaseUrl: getApiBaseUrl(),
      })
      return
    }

    let destroyed = false
    const clearReconnectTimer = () => {
      if (chatReconnectTimerRef.current !== null) {
        window.clearTimeout(chatReconnectTimerRef.current)
        chatReconnectTimerRef.current = null
      }
    }

    const connect = () => {
      let ws: WebSocket
      try {
        ws = new WebSocket(resolvedChatWsUrl)
      } catch {
        return
      }

      chatWsRef.current = ws
      queueMicrotask(() => {
        setChatWsConnected(false)
      })

      ws.onopen = () => {
        chatReconnectAttemptRef.current = 0
        clearReconnectTimer()
        setChatWsConnected(true)
      }
      ws.onclose = (event) => {
        setChatWsConnected(false)
        if (chatWsRef.current === ws) {
          chatWsRef.current = null
        }
        console.warn('[MapInstancePage] Chat WebSocket closed', {
          chatWsPath,
          resolvedChatWsUrl,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        })
        if (destroyed) {
          return
        }
        const retryDelay =
          WS_RECONNECT_BACKOFF_MS[
            Math.min(chatReconnectAttemptRef.current, WS_RECONNECT_BACKOFF_MS.length - 1)
          ]
        chatReconnectAttemptRef.current += 1
        clearReconnectTimer()
        chatReconnectTimerRef.current = window.setTimeout(() => {
          connect()
        }, retryDelay)
      }
      ws.onerror = () => {
        setChatWsConnected(false)
        console.warn('[MapInstancePage] Chat WebSocket connection error', {
          chatWsPath,
          resolvedChatWsUrl,
        })
      }
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type?: string
            payload?: unknown
            data?: unknown
          }
          const type = resolveEventType(payload as unknown as Record<string, unknown>)
          const actualPayload = payload.payload ?? payload.data ?? payload
          const isChatHistoryType =
            CHAT_HISTORY_TOPIC_ALIASES.has(type) || type.startsWith('chat.history')
          const isChatMessageType =
            CHAT_MESSAGE_TOPIC_ALIASES.has(type) ||
            type.startsWith('chat.message') ||
            type.startsWith('chat.send')

          if (isChatHistoryType || isChatMessageType || !type) {
            const chatItems = readChatMessagesPayload(actualPayload).map((item) => ({
              ...item,
              isLocal: isLocalChatMessage(
                item,
                localClientIdRef.current,
                localDisplayNameRef.current
              ),
            }))
            appendChatMessages(chatItems, { countUnread: !isChatHistoryType })
          }
        } catch {
          // Ignore non-JSON messages.
        }
      }
    }

    chatReconnectAttemptRef.current = 0
    clearReconnectTimer()
    connect()

    return () => {
      destroyed = true
      clearReconnectTimer()
      const ws = chatWsRef.current
      if (ws) {
        ws.close()
      }
      chatWsRef.current = null
      setChatWsConnected(false)
    }
  }, [appendChatMessages, instance?.id])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemoteCursors((prev) => {
        const now = Date.now()
        const nextEntries = Object.values(prev).filter((item) => now - item.updatedAt <= 6000)
        if (nextEntries.length === Object.keys(prev).length) {
          return prev
        }
        return Object.fromEntries(nextEntries.map((item) => [item.clientId, item]))
      })
    }, 2000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!instance?.id) {
      return
    }

    let active = true
    stateHydratedRef.current = false
    void getWhiteboardState(instance.id)
      .then((response) => {
        if (!active) {
          return
        }
        const restored = readStrokesFromState(response.state)
        setStrokes(restored)
        stateHydratedRef.current = true
      })
      .catch(() => {
        if (active) {
          stateHydratedRef.current = true
        }
      })

    return () => {
      active = false
    }
  }, [instance?.id])

  useEffect(() => {
    if (!instance?.id || !stateHydratedRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveWhiteboardState(instance.id, { mapId: instance.mapId, strokes })
    }, 450)

    return () => {
      window.clearTimeout(timer)
    }
  }, [instance?.id, instance?.mapId, strokes])

  const sendWsMessage = useCallback((message: Record<string, unknown>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false
    }
    ws.send(JSON.stringify(message))
    return true
  }, [])

  const sendChatWsMessage = useCallback((message: Record<string, unknown>) => {
    const ws = chatWsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false
    }
    ws.send(JSON.stringify(message))
    return true
  }, [])

  const clearAppendTimer = useCallback(() => {
    if (appendTimerRef.current !== null) {
      window.clearTimeout(appendTimerRef.current)
      appendTimerRef.current = null
    }
  }, [])

  const flushStrokeAppend = useCallback(() => {
    const stroke = currentStrokeRef.current
    if (!stroke) {
      pendingAppendPointsRef.current = []
      clearAppendTimer()
      return
    }
    const points = pendingAppendPointsRef.current
    if (points.length === 0) {
      clearAppendTimer()
      return
    }

    pendingAppendPointsRef.current = []
    clearAppendTimer()
    sendWsMessage({
      type: WHITEBOARD_STROKE_APPEND_TOPIC,
      payload: {
        strokeId: stroke.id,
        points,
        clientId: localClientIdRef.current,
        color: stroke.color,
        width: stroke.width,
      },
    })
  }, [clearAppendTimer, sendWsMessage])

  const scheduleStrokeAppend = useCallback(() => {
    if (appendTimerRef.current !== null) {
      return
    }
    appendTimerRef.current = window.setTimeout(() => {
      flushStrokeAppend()
    }, STROKE_APPEND_INTERVAL_MS)
  }, [flushStrokeAppend])

  const toWorldPoint = (clientX: number, clientY: number): Point | null => {
    const element = containerRef.current
    if (!element) {
      return null
    }
    const rect = element.getBoundingClientRect()
    const x = (clientX - rect.left - viewport.x) / viewport.scale
    const y = (clientY - rect.top - viewport.y) / viewport.scale
    return { x, y }
  }

  const toLocalPoint = (clientX: number, clientY: number): LocalPoint | null => {
    const element = containerRef.current
    if (!element) {
      return null
    }
    const rect = element.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.cancelable) {
      event.preventDefault()
    }
    const isTouch = event.pointerType === 'touch'
    if (isTouch) {
      const localPoint = toLocalPoint(event.clientX, event.clientY)
      if (localPoint) {
        activeTouchPointsRef.current.set(event.pointerId, localPoint)
      }
    }

    if (isTouch && activeTouchPointsRef.current.size >= 2) {
      if (currentStroke) {
        setCurrentStroke(null)
      }
      const [first, second] = Array.from(activeTouchPointsRef.current.values())
      if (first && second) {
        const center = midpointBetween(first, second)
        const startDistance = distanceBetween(first, second)
        const safeDistance = startDistance > 0 ? startDistance : 1
        pinchRef.current = {
          worldX: (center.x - viewport.x) / viewport.scale,
          worldY: (center.y - viewport.y) / viewport.scale,
          startDistance: safeDistance,
          startScale: viewport.scale,
        }
        pointerModeRef.current = 'pinch'
      }
      activePointerIdRef.current = null
      panAnchorRef.current = null
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    const isPan = event.button === 1 || event.button === 2 || event.shiftKey
    pointerModeRef.current = isPan ? 'pan' : 'draw'
    activePointerIdRef.current = event.pointerId

    if (pointerModeRef.current === 'pan') {
      panAnchorRef.current = {
        x: event.clientX,
        y: event.clientY,
        startX: viewport.x,
        startY: viewport.y,
      }
    } else {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) {
        return
      }
      const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setCurrentStroke({
        id: strokeId,
        points: [point],
        color: brushColor,
        width: brushWidth,
      })
      sendWsMessage({
        type: WHITEBOARD_STROKE_START_TOPIC,
        payload: {
          strokeId,
          point,
          color: brushColor,
          width: brushWidth,
          clientId: localClientIdRef.current,
        },
      })
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    const worldPointForCursor = toWorldPoint(event.clientX, event.clientY)
    if (worldPointForCursor) {
      const now = Date.now()
      if (now - lastCursorSentAtRef.current > 40) {
        lastCursorSentAtRef.current = now
        sendWsMessage({
          type: WHITEBOARD_CURSOR_MOVE_TOPIC,
          payload: {
            clientId: localClientIdRef.current,
            x: worldPointForCursor.x,
            y: worldPointForCursor.y,
            label: localClientIdRef.current.slice(0, 4).toUpperCase(),
            color: colorFromId(localClientIdRef.current),
          },
        })
      }
    }

    if (event.pointerType === 'touch') {
      const localPoint = toLocalPoint(event.clientX, event.clientY)
      if (localPoint) {
        activeTouchPointsRef.current.set(event.pointerId, localPoint)
      }
    }

    if (
      pointerModeRef.current === 'pinch' &&
      activeTouchPointsRef.current.size >= 2 &&
      pinchRef.current
    ) {
      const pinch = pinchRef.current
      if (!pinch) {
        return
      }
      const [first, second] = Array.from(activeTouchPointsRef.current.values())
      if (!first || !second) {
        return
      }
      const center = midpointBetween(first, second)
      const distance = distanceBetween(first, second)

      setViewport(() => {
        const normalizedScale = clamp(
          (distance / pinch.startDistance) * pinch.startScale,
          MIN_SCALE,
          MAX_SCALE
        )
        return {
          scale: normalizedScale,
          x: center.x - pinch.worldX * normalizedScale,
          y: center.y - pinch.worldY * normalizedScale,
        }
      })
      return
    }

    if (activePointerIdRef.current !== event.pointerId) {
      return
    }
    const panAnchor = panAnchorRef.current
    if (pointerModeRef.current === 'pan' && panAnchor) {
      const deltaX = event.clientX - panAnchor.x
      const deltaY = event.clientY - panAnchor.y
      setViewport((prev) => ({
        ...prev,
        x: panAnchor.startX + deltaX,
        y: panAnchor.startY + deltaY,
      }))
      return
    }

    if (pointerModeRef.current !== 'draw' || !currentStroke) {
      return
    }
    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) {
      return
    }
    pendingAppendPointsRef.current.push(point)
    scheduleStrokeAppend()
    setCurrentStroke((prev) => (prev ? { ...prev, points: [...prev.points, point] } : prev))
  }

  const finishStroke = () => {
    const stroke = currentStrokeRef.current
    if (!stroke || stroke.points.length < 1) {
      setCurrentStroke(null)
      pendingAppendPointsRef.current = []
      clearAppendTimer()
      return
    }
    flushStrokeAppend()
    localStrokeIdsRef.current.add(stroke.id)
    setStrokes((prev) => [...prev, stroke])
    sendWsMessage({
      type: WHITEBOARD_STROKE_END_TOPIC,
      payload: { strokeId: stroke.id, clientId: localClientIdRef.current },
    })
    setCurrentStroke(null)
  }

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    activeTouchPointsRef.current.delete(event.pointerId)

    if (pointerModeRef.current === 'pinch') {
      if (activeTouchPointsRef.current.size < 2) {
        pointerModeRef.current = null
        pinchRef.current = null
        activePointerIdRef.current = null
        pendingAppendPointsRef.current = []
        clearAppendTimer()
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      return
    }

    if (activePointerIdRef.current !== event.pointerId) {
      return
    }
    if (pointerModeRef.current === 'draw') {
      finishStroke()
    }
    pointerModeRef.current = null
    activePointerIdRef.current = null
    panAnchorRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onPointerLeave: React.PointerEventHandler<HTMLDivElement> = () => {
    sendWsMessage({
      type: WHITEBOARD_CURSOR_LEAVE_TOPIC,
      payload: { clientId: localClientIdRef.current, x: 0, y: 0 },
    })
  }

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const element = containerRef.current
    if (!element) {
      return
    }
    const rect = element.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    const scaleFactor = clamp(Math.exp(-event.deltaY * 0.0012), 0.96, 1.04)

    setViewport((prev) => {
      const nextScale = clamp(prev.scale * scaleFactor, MIN_SCALE, MAX_SCALE)
      const worldX = (mouseX - prev.x) / prev.scale
      const worldY = (mouseY - prev.y) / prev.scale
      return {
        scale: nextScale,
        x: mouseX - worldX * nextScale,
        y: mouseY - worldY * nextScale,
      }
    })
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel, loading])

  const fitViewportToContent = useCallback((width: number, height: number) => {
    const element = containerRef.current
    if (!element || width <= 0 || height <= 0) {
      return
    }

    const containerWidth = element.clientWidth
    const containerHeight = element.clientHeight
    if (containerWidth <= 0 || containerHeight <= 0) {
      return
    }

    const nextScale = clamp(
      Math.min(containerWidth / width, containerHeight / height),
      MIN_SCALE,
      MAX_SCALE
    )
    const nextX = (containerWidth - width * nextScale) / 2
    const nextY = (containerHeight - height * nextScale) / 2

    setViewport({
      x: nextX,
      y: nextY,
      scale: nextScale,
    })
  }, [])

  const clearBoard = () => {
    setStrokes([])
    setCurrentStroke(null)
    setRemoteInProgressStrokes({})
    localStrokeIdsRef.current.clear()
    sendWsMessage({ type: WHITEBOARD_CLEAR_TOPIC, payload: {} })
  }

  const undoLastStroke = useCallback(() => {
    const removed = strokes[strokes.length - 1]
    if (!removed) {
      return
    }
    setStrokes((prev) => prev.slice(0, -1))
    localStrokeIdsRef.current.delete(removed.id)
    sendWsMessage({
      type: WHITEBOARD_UNDO_TOPIC,
      payload: {
        strokeId: removed.id,
        clientId: localClientIdRef.current,
      },
    })
  }, [sendWsMessage, strokes])

  useEffect(() => {
    const handleUndoHotkey = (event: KeyboardEvent) => {
      const isUndoKey = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey
      if (!isUndoKey || event.key.toLowerCase() !== 'z') {
        return
      }

      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName
        const isEditable =
          target.isContentEditable ||
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT'
        if (isEditable) {
          return
        }
      }

      if (strokes.length === 0) {
        return
      }

      event.preventDefault()
      undoLastStroke()
    }

    window.addEventListener('keydown', handleUndoHotkey)
    return () => {
      window.removeEventListener('keydown', handleUndoHotkey)
    }
  }, [strokes.length, undoLastStroke])

  const sendChatMessage = () => {
    const text = chatInput.trim()
    if (!text) {
      return
    }

    const sent = sendChatWsMessage({
      senderName: localDisplayNameRef.current,
      content: text,
    })

    setChatInput('')
    if (sent) {
      return
    }

    const localFailedMessage: ChatMessage = {
      id: `chat-failed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      clientId: localClientIdRef.current,
      text,
      displayName: localDisplayNameRef.current,
      sentAt: Date.now(),
      isLocal: true,
      failed: true,
    }
    chatMessageIdsRef.current.add(localFailedMessage.id)
    setChatMessages((prev) => [...prev, localFailedMessage].slice(-CHAT_MAX_MESSAGES))
  }

  const copyInstanceId = async () => {
    const value = instance?.id ?? instanceId
    if (!value) {
      return
    }
    try {
      const ok = await copyText(value)
      if (!ok) {
        setCopied(false)
        return
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const renderedStrokes = useMemo(() => {
    const list = currentStroke ? [...strokes, currentStroke] : strokes
    return list.map((stroke) => (
      <path
        key={stroke.id}
        d={buildPathData(stroke.points)}
        fill="none"
        stroke={stroke.color}
        strokeWidth={stroke.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ))
  }, [currentStroke, strokes])

  const renderedRemoteInProgressStrokes = useMemo(() => {
    return Object.values(remoteInProgressStrokes).map((stroke) => (
      <path
        key={stroke.id}
        d={buildPathData(stroke.points)}
        fill="none"
        stroke={stroke.color}
        strokeWidth={stroke.width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.82}
      />
    ))
  }, [remoteInProgressStrokes])

  const renderedRemoteCursors = useMemo(() => {
    const baseRadius = 7 * cursorScale
    const ringRadius = baseRadius + 4
    return Object.values(remoteCursors).map((cursor) => (
      <g key={cursor.clientId}>
        <circle
          cx={cursor.x}
          cy={cursor.y}
          r={ringRadius}
          fill="none"
          stroke="rgba(255,255,255,0.96)"
          strokeWidth={2.6}
        />
        <circle
          cx={cursor.x}
          cy={cursor.y}
          r={ringRadius + 2}
          fill="none"
          stroke="rgba(0,0,0,0.65)"
          strokeWidth={1.4}
        />
        <line
          x1={cursor.x - ringRadius - 5}
          y1={cursor.y}
          x2={cursor.x + ringRadius + 5}
          y2={cursor.y}
          stroke="rgba(255,255,255,0.72)"
          strokeWidth={1.5}
        />
        <line
          x1={cursor.x}
          y1={cursor.y - ringRadius - 5}
          x2={cursor.x}
          y2={cursor.y + ringRadius + 5}
          stroke="rgba(255,255,255,0.72)"
          strokeWidth={1.5}
        />
        <circle
          cx={cursor.x}
          cy={cursor.y}
          r={baseRadius}
          fill={cursor.color}
          fillOpacity={0.95}
          stroke="rgba(0,0,0,0.72)"
          strokeWidth={2.1}
        />
        <rect
          x={cursor.x + 12}
          y={cursor.y - 22}
          rx={6}
          ry={6}
          width={Math.max(56, cursor.label.length * 9)}
          height={20}
          fill="rgba(0,0,0,0.66)"
          stroke={cursor.color}
          strokeWidth={1.1}
        />
        <text x={cursor.x + 10} y={cursor.y - 8} fontSize={14} fontWeight={700} fill="#f8fafc">
          {cursor.label}
        </text>
      </g>
    ))
  }, [cursorScale, remoteCursors])

  if (!instanceId || (!loading && !instance)) {
    return (
      <main className="app-page grid place-items-center px-4 py-8">
        <section className="panel w-full max-w-xl p-6 md:p-8">
          <h1 className="text-3xl font-extrabold text-white">{t('mapInstance.notFoundTitle')}</h1>
          <p className="mt-3 text-slate-50/75">{t('mapInstance.notFoundDesc')}</p>
          <button type="button" onClick={onBackHome} className="btn-primary mt-5">
            {t('common.backHome')}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-page box-border h-screen h-[100dvh] overflow-hidden px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-14 md:h-screen md:px-3 md:pb-3 md:pt-16">
      <section className="mx-auto flex h-full w-full max-w-none flex-col gap-2">
        <div className="panel flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-200 md:hidden">
          <span className="truncate">
            {t('mapInstance.instanceId')}: {instance?.id ?? instanceId}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {renderConnectionBadge(t('mapInstance.instanceConnection'), wsConnected)}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleChatVisibility}
              className="btn-base relative min-h-8 rounded-lg border border-amber-300/45 bg-amber-500/15 px-2.5 py-1 text-xs text-amber-100"
            >
              <FiMessageSquare />
              <span>{chatVisible ? t('mapInstance.hideChat') : t('mapInstance.showChat')}</span>
              {chatUnread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-slate-900">
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="btn-base min-h-8 rounded-lg border border-slate-500/70 bg-slate-700/45 px-3 py-1 text-xs text-slate-100"
            >
              {t('mapInstance.tools')}
            </button>
          </div>
        </div>

        <div className="panel hidden flex-wrap items-center gap-3 px-3 py-2 text-sm text-slate-200 md:flex">
          <span className="inline-flex items-center gap-2">
            <span>
              {t('mapInstance.instanceId')}: {instance?.id ?? instanceId}
            </span>
            <button
              type="button"
              onClick={() => void copyInstanceId()}
              className="btn-base rounded-lg border border-amber-300/45 bg-amber-400/15 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-300/25"
            >
              <FiCopy />
              <span>{copied ? t('mapInstance.copied') : t('mapInstance.copyId')}</span>
            </button>
          </span>
          <span>
            {t('mapInstance.mapId')}: {instance?.mapId ?? '-'} · {resolveMapLabel(instance?.mapId)}
          </span>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/75 px-3 py-1.5">
            <span className="text-xs text-slate-300">{t('mapInstance.switchMap')}</span>
            <select
              value={selectedMapId ?? ''}
              onChange={(event) => {
                const nextValue = Number(event.target.value)
                setSelectedMapId(Number.isFinite(nextValue) ? nextValue : null)
              }}
              disabled={mapPresets.length === 0 || switchingMap}
              className="h-8 min-w-[11rem] rounded-lg border border-slate-500/70 bg-slate-950/80 px-2 text-xs text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-55"
            >
              {mapPresets.length === 0 && (
                <option value="">{t('mapInstance.switchMapEmpty')}</option>
              )}
              {mapPresets.map((item) => (
                <option key={item.mapId} value={item.mapId}>
                  {item.nameZh || item.nameEn || item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSwitchMap}
              disabled={
                switchingMap ||
                mapPresets.length === 0 ||
                !selectedMapId ||
                selectedMapId === instance?.mapId
              }
              className="btn-base h-8 rounded-lg border border-amber-300/45 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {switchingMap ? t('common.loading') : t('mapInstance.switchMapApply')}
            </button>
          </div>
          {renderConnectionBadge(t('mapInstance.instanceConnection'), wsConnected)}
          <span>
            {t('mapInstance.zoom')}: {Math.round(viewport.scale * 100)}%
          </span>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/75 px-3 py-1.5">
            <span className="text-xs text-slate-300">{t('mapInstance.brushColor')}</span>
            <input
              type="color"
              value={brushColor}
              onChange={(event) => setBrushColor(event.target.value)}
              className="h-7 w-9 rounded border border-slate-500/70 bg-transparent p-0"
              aria-label={t('mapInstance.brushColor')}
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/75 px-3 py-1.5">
            <span className="text-xs text-slate-300">{t('mapInstance.brushWidth')}</span>
            <input
              type="range"
              min={12}
              max={48}
              step={1}
              value={brushWidth}
              onChange={(event) => setBrushWidth(Number(event.target.value))}
              className="w-24 accent-amber-400"
              aria-label={t('mapInstance.brushWidth')}
            />
            <span className="w-5 text-right text-xs text-slate-200">{brushWidth}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/75 px-3 py-1.5">
            <span className="text-xs text-slate-300">{t('mapInstance.cursorSize')}</span>
            <input
              type="range"
              min={1}
              max={2.6}
              step={0.1}
              value={cursorScale}
              onChange={(event) => setCursorScale(Number(event.target.value))}
              className="w-24 accent-amber-400"
              aria-label={t('mapInstance.cursorSize')}
            />
            <span className="w-8 text-right text-xs text-slate-200">{cursorScale.toFixed(1)}x</span>
          </div>
          <button
            type="button"
            onClick={toggleChatVisibility}
            className="btn-base relative rounded-lg border border-amber-300/45 bg-amber-500/15 px-3 py-1.5 text-amber-100 hover:bg-amber-400/25"
          >
            <FiMessageSquare />
            <span>{chatVisible ? t('mapInstance.hideChat') : t('mapInstance.showChat')}</span>
            {chatUnread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-slate-900">
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => fitViewportToContent(contentSize.width, contentSize.height)}
            className="btn-base rounded-lg border border-amber-300/45 bg-amber-500/15 px-3 py-1.5 text-amber-100 hover:bg-amber-400/25"
          >
            {t('mapInstance.resetView')}
          </button>
          <button
            type="button"
            onClick={clearBoard}
            className="btn-base rounded-lg border border-rose-300/45 bg-rose-500/15 px-3 py-1.5 text-rose-100 hover:bg-rose-400/25"
          >
            {t('mapInstance.clearBoard')}
          </button>
          <button
            type="button"
            onClick={undoLastStroke}
            disabled={strokes.length === 0}
            className="btn-base rounded-lg border border-slate-500/60 bg-slate-700/35 px-3 py-1.5 text-slate-100 hover:bg-slate-600/45 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t('mapInstance.undoLastStroke')}
          </button>
          <button
            type="button"
            onClick={onBackHome}
            className="btn-base rounded-lg border border-slate-500/60 bg-slate-700/35 px-3 py-1.5 text-slate-100 hover:bg-slate-600/45"
          >
            {t('mapInstance.backToMaps')}
          </button>
        </div>

        <div className="panel px-3 py-1.5 text-[11px] text-slate-300">
          {t('mapInstance.panHint')}
        </div>

        <div
          className={`fixed inset-0 z-40 md:hidden ${mobileDrawerOpen ? '' : 'pointer-events-none'}`}
        >
          <button
            type="button"
            aria-label={t('mapInstance.closeTools')}
            onClick={() => setMobileDrawerOpen(false)}
            className={`absolute inset-0 bg-black/45 transition-opacity ${mobileDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
          />
          <div
            className={`absolute inset-x-2 top-14 max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-2xl border border-slate-600 bg-[#0f172a] px-4 pb-5 pt-4 transition-all duration-200 ${mobileDrawerOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">{t('mapInstance.tools')}</p>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="btn-base min-h-8 rounded-lg border border-slate-500/70 bg-slate-700/45 px-2.5 py-1 text-xs text-slate-100"
              >
                {t('mapInstance.closeTools')}
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                {t('mapInstance.instanceId')}: {instance?.id ?? instanceId}
              </p>
              <p>
                {t('mapInstance.mapId')}: {instance?.mapId ?? '-'} · {resolveMapLabel(instance?.mapId)}
              </p>
              <p>
                {t('mapInstance.zoom')}: {Math.round(viewport.scale * 100)}%
              </p>
              <div className="flex flex-wrap gap-1.5">
                {renderConnectionBadge(t('mapInstance.instanceConnection'), wsConnected)}
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-600 bg-slate-900/75 p-3">
              <p className="text-xs font-medium text-slate-300">{t('mapInstance.switchMap')}</p>
              <div className="mt-2 grid gap-2">
                <select
                  value={selectedMapId ?? ''}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value)
                    setSelectedMapId(Number.isFinite(nextValue) ? nextValue : null)
                  }}
                  disabled={mapPresets.length === 0 || switchingMap}
                  className="h-9 w-full rounded-lg border border-slate-500/70 bg-slate-950/80 px-2 text-xs text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {mapPresets.length === 0 && (
                    <option value="">{t('mapInstance.switchMapEmpty')}</option>
                  )}
                  {mapPresets.map((item) => (
                    <option key={item.mapId} value={item.mapId}>
                      {item.nameZh || item.nameEn || item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSwitchMap}
                  disabled={
                    switchingMap ||
                    mapPresets.length === 0 ||
                    !selectedMapId ||
                    selectedMapId === instance?.mapId
                  }
                  className="btn-base min-h-8 rounded-lg border border-amber-300/45 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {switchingMap ? t('common.loading') : t('mapInstance.switchMapApply')}
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copyInstanceId()}
                className="btn-base min-h-8 rounded-lg border border-amber-300/45 bg-amber-400/15 px-3 py-1.5 text-xs text-amber-100"
              >
                {copied ? t('mapInstance.copied') : t('mapInstance.copyId')}
              </button>
              <button
                type="button"
                onClick={toggleChatVisibility}
                className="btn-base min-h-8 rounded-lg border border-amber-300/45 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100"
              >
                {chatVisible ? t('mapInstance.hideChat') : t('mapInstance.showChat')}
              </button>
              <button
                type="button"
                onClick={() => {
                  fitViewportToContent(contentSize.width, contentSize.height)
                  setMobileDrawerOpen(false)
                }}
                className="btn-base min-h-8 rounded-lg border border-amber-300/45 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100"
              >
                {t('mapInstance.resetView')}
              </button>
              <button
                type="button"
                onClick={clearBoard}
                className="btn-base min-h-8 rounded-lg border border-rose-300/45 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-100"
              >
                {t('mapInstance.clearBoard')}
              </button>
              <button
                type="button"
                onClick={undoLastStroke}
                disabled={strokes.length === 0}
                className="btn-base min-h-8 rounded-lg border border-slate-500/60 bg-slate-700/35 px-3 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t('mapInstance.undoLastStroke')}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/75 px-3 py-2">
              <span className="text-xs text-slate-300">{t('mapInstance.brushColor')}</span>
              <input
                type="color"
                value={brushColor}
                onChange={(event) => setBrushColor(event.target.value)}
                className="h-8 w-full rounded border border-slate-500/70 bg-transparent p-0"
                aria-label={t('mapInstance.brushColor')}
              />
              <span />
            </div>

            <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/75 px-3 py-2">
              <span className="text-xs text-slate-300">{t('mapInstance.brushWidth')}</span>
              <input
                type="range"
                min={12}
                max={48}
                step={1}
                value={brushWidth}
                onChange={(event) => setBrushWidth(Number(event.target.value))}
                className="w-full accent-amber-400"
                aria-label={t('mapInstance.brushWidth')}
              />
              <span className="w-6 text-right text-xs text-slate-200">{brushWidth}</span>
            </div>

            <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/75 px-3 py-2">
              <span className="text-xs text-slate-300">{t('mapInstance.cursorSize')}</span>
              <input
                type="range"
                min={1}
                max={2.6}
                step={0.1}
                value={cursorScale}
                onChange={(event) => setCursorScale(Number(event.target.value))}
                className="w-full accent-amber-400"
                aria-label={t('mapInstance.cursorSize')}
              />
              <span className="w-10 text-right text-xs text-slate-200">
                {cursorScale.toFixed(1)}x
              </span>
            </div>

            <button
              type="button"
              onClick={onBackHome}
              className="btn-base mt-3 min-h-8 w-full rounded-lg border border-slate-500/60 bg-slate-700/35 px-3 py-1.5 text-xs text-slate-100"
            >
              {t('mapInstance.backToMaps')}
            </button>
          </div>
        </div>

        {loading && (
          <div className="panel px-4 py-3 text-sm text-slate-300">{t('common.loading')}</div>
        )}

        {!loading && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
            <div
              ref={containerRef}
              className="relative min-h-[52vh] min-w-0 flex-1 touch-none overflow-hidden rounded-2xl border border-slate-600 bg-[#0b1220] select-none md:min-h-0"
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerLeave}
            >
              <div
                className="absolute left-0 top-0 select-none"
                onDragStart={(event) => event.preventDefault()}
                style={{
                  width: `${contentSize.width}px`,
                  height: `${contentSize.height}px`,
                  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                  transformOrigin: '0 0',
                }}
              >
                {mapUrl ? (
                  <img
                    src={mapUrl}
                    alt={instance?.mapId ? `${t('mapInstance.mapId')} ${instance.mapId}` : 'map'}
                    className="pointer-events-none block h-full w-full select-none object-contain"
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    onLoad={(event) => {
                      const image = event.currentTarget
                      const nextWidth = image.naturalWidth || DEFAULT_CANVAS_WIDTH
                      const nextHeight = image.naturalHeight || DEFAULT_CANVAS_HEIGHT
                      setContentSize({
                        width: nextWidth,
                        height: nextHeight,
                      })
                      fitViewportToContent(nextWidth, nextHeight)
                    }}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[linear-gradient(120deg,#0f172a,#1f2937)] text-slate-100/80">
                    {t('mapInstance.noMapBackground')}
                  </div>
                )}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  viewBox={`0 0 ${contentSize.width} ${contentSize.height}`}
                  preserveAspectRatio="none"
                >
                  {renderedStrokes}
                  {renderedRemoteInProgressStrokes}
                  {renderedRemoteCursors}
                </svg>
              </div>
            </div>

            {chatVisible && (
              <>
                <button
                  type="button"
                  aria-label={t('mapInstance.closeChat')}
                  onClick={() => setChatVisible(false)}
                  className="fixed inset-0 z-40 bg-black/45 md:hidden"
                />
                <aside className="panel fixed inset-x-2 top-16 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-50 flex min-h-0 flex-col overflow-hidden md:static md:inset-auto md:z-auto md:w-[22rem] md:max-w-[42vw] md:shrink-0">
                  <div className="flex items-center justify-between border-b border-slate-700/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{t('mapInstance.chat')}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {renderConnectionBadge(t('mapInstance.chatConnection'), chatWsConnected)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatVisible(false)}
                      className="btn-base min-h-7 rounded-lg border border-slate-500/70 bg-slate-700/45 px-2.5 py-1 text-[11px] text-slate-100 md:hidden"
                    >
                      {t('mapInstance.closeChat')}
                    </button>
                  </div>

                  <div
                    ref={chatScrollRef}
                    className="scrollbar-tactical flex-1 space-y-2 overflow-auto px-2.5 py-2.5"
                  >
                    {chatMessages.length === 0 && (
                      <p className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
                        {t('mapInstance.chatEmpty')}
                      </p>
                    )}

                    {chatMessages.map((item) => (
                      <div
                        key={item.id}
                        className={`flex ${item.isLocal ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={[
                            'max-w-[92%] rounded-lg border px-2.5 py-2',
                            item.isLocal
                              ? 'border-amber-300/45 bg-amber-500/14 text-amber-50'
                              : 'border-slate-600/80 bg-slate-800/75 text-slate-100',
                          ].join(' ')}
                        >
                          <p className="text-[11px] text-slate-300/80">
                            {item.isLocal ? t('mapInstance.you') : item.displayName}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5">
                            {item.text}
                          </p>
                          <p className="mt-1 text-right text-[10px] text-slate-400">
                            {formatChatTime(item.sentAt)}
                            {item.failed ? ` · ${t('mapInstance.chatSendFailed')}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-700/70 p-2.5 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] md:pb-2.5">
                    <div className="ios-input flex items-center gap-2 px-2 py-1.5">
                      <input
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            sendChatMessage()
                          }
                        }}
                        placeholder={t('mapInstance.chatPlaceholder')}
                        className="h-8 flex-1 bg-transparent px-1 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={sendChatMessage}
                        className="btn-base min-h-8 rounded-lg border border-amber-300/45 bg-amber-500/14 px-2.5 py-1 text-xs text-amber-100"
                      >
                        <FiSend />
                        <span>{t('mapInstance.sendMessage')}</span>
                      </button>
                    </div>
                    {!chatWsConnected && (
                      <p className="mt-2 text-[11px] text-amber-200/80">
                        {t('mapInstance.chatOfflineHint')}
                      </p>
                    )}
                  </div>
                </aside>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
