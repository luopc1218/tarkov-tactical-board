import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FiCopy, FiEdit3, FiTrash2 } from 'react-icons/fi'
import type { TarkovMapPreset } from '../constants/maps'
import { fetchMapPresets } from '../api/maps'
import {
  getWhiteboardMapIntel,
  getWhiteboardInstance,
  getWhiteboardState,
  saveWhiteboardState,
  switchWhiteboardMap,
  type ExtractionIntelItem,
  type HighValueLootIntelItem,
  type MapIntelResponse,
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

type ToolMode = 'draw' | 'erase'

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

const renderIntelBool = (value: boolean | null, t: (key: string) => string) => {
  if (value === null) {
    return t('mapInstance.notProvided')
  }
  return value ? t('mapInstance.yes') : t('mapInstance.no')
}

const getIntelTagTone = (index: number) => {
  const tones = [
    'border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
    'border-amber-300/30 bg-amber-400/10 text-amber-100',
    'border-lime-300/30 bg-lime-400/10 text-lime-100',
    'border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-100',
  ]
  return tones[index % tones.length]
}

const isGuaranteedSpawnChance = (value: string) => {
  const normalized = value.replace(/\s+/g, '').trim()
  return normalized === '100%'
}

const DEFAULT_CANVAS_WIDTH = 1920
const DEFAULT_CANVAS_HEIGHT = 1080
const MIN_SCALE = 0.05
const MAX_SCALE = 8
const WHEEL_ZOOM_SENSITIVITY = 0.0024
const WHEEL_ZOOM_FACTOR_MIN = 0.92
const WHEEL_ZOOM_FACTOR_MAX = 1.08
const WHITEBOARD_STROKE_START_TOPIC = 'stroke.start'
const WHITEBOARD_STROKE_APPEND_TOPIC = 'stroke.append'
const WHITEBOARD_STROKE_END_TOPIC = 'stroke.end'
const WHITEBOARD_CLEAR_TOPIC = 'board.clear'
const WHITEBOARD_UNDO_TOPIC = 'stroke.undo'
const WHITEBOARD_ERASE_TOPIC = 'stroke.erase'
const WHITEBOARD_CURSOR_MOVE_TOPIC = 'cursor.move'
const WHITEBOARD_CURSOR_LEAVE_TOPIC = 'cursor.leave'
const WHITEBOARD_MAP_CHANGED_TOPIC = 'map.changed'
const STROKE_APPEND_INTERVAL_MS = 40
const WS_RECONNECT_BACKOFF_MS = [1000, 2000, 5000]

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
const distanceToSegment = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
  const t = clamp(projection, 0, 1)
  const nearestX = start.x + dx * t
  const nearestY = start.y + dy * t
  return Math.hypot(point.x - nearestX, point.y - nearestY)
}

const isPointNearStroke = (point: Point, stroke: Stroke, tolerance: number) => {
  if (stroke.points.length === 0) {
    return false
  }
  if (stroke.points.length === 1) {
    return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) <= tolerance
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    if (distanceToSegment(point, stroke.points[index - 1], stroke.points[index]) <= tolerance) {
      return true
    }
  }
  return false
}

const colorFromId = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 90% 62%)`
}

const resolveWsUrl = (wsPath: string) => {
  if (/^wss?:\/\//i.test(wsPath)) {
    return wsPath
  }

  if (/^https?:\/\//i.test(wsPath)) {
    return wsPath.replace(/^http/i, 'ws')
  }

  try {
    const apiBase = new URL(getApiBaseUrl(), window.location.origin)
    const protocol = apiBase.protocol === 'https:' ? 'wss:' : 'ws:'
    const normalizedWsPath = wsPath.startsWith('/') ? wsPath : `/${wsPath}`
    const apiPath = apiBase.pathname.replace(/\/+$/, '')
    const resolvedPath = `${apiPath}/ws${normalizedWsPath}`.replace(/\/{2,}/g, '/')
    return `${protocol}//${apiBase.host}${resolvedPath}`
  } catch {
    return null
  }
}

const buildWhiteboardWsPath = (instanceId: string) =>
  `/whiteboard/${encodeURIComponent(instanceId)}`

const createRealtimeClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `c-${crypto.randomUUID()}`
  }
  return `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
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

const pickString = (source: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = readString(source[key])
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
  const [toolMode, setToolMode] = useState<ToolMode>('draw')
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [wsConnected, setWsConnected] = useState(false)
  const [contentSize, setContentSize] = useState({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  })
  const [brushColor, setBrushColor] = useState('#ff3b30')
  const [brushWidth, setBrushWidth] = useState(16)
  const [cursorScale, setCursorScale] = useState(1.8)
  const [copied, setCopied] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [intelDrawerOpen, setIntelDrawerOpen] = useState(false)
  const [mapIntel, setMapIntel] = useState<MapIntelResponse | null>(null)
  const [mapIntelLoadError, setMapIntelLoadError] = useState<string | null>(null)
  const [mapIntelPanelOpen, setMapIntelPanelOpen] = useState(true)
  const [bossIntelOpen, setBossIntelOpen] = useState(true)
  const [extractionsOpen, setExtractionsOpen] = useState(true)
  const [highValueLootOpen, setHighValueLootOpen] = useState(true)
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({})
  const [remoteInProgressStrokes, setRemoteInProgressStrokes] = useState<Record<string, Stroke>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const localStrokeIdsRef = useRef(new Set<string>())
  const localClientIdRef = useRef(createRealtimeClientId())
  const lastCursorSentAtRef = useRef(0)
  const pointerModeRef = useRef<'draw' | 'erase' | 'pan' | 'pinch' | null>(null)
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
  const erasedStrokeIdsRef = useRef(new Set<string>())

  useEffect(() => {
    currentStrokeRef.current = currentStroke
  }, [currentStroke])

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
    if (!instance?.id) {
      return
    }

    const whiteboardWsPath = buildWhiteboardWsPath(instance.id)
    const resolvedWsUrl = resolveWsUrl(whiteboardWsPath)
    if (!resolvedWsUrl) {
      console.warn('[MapInstancePage] Unable to resolve websocket url', {
        whiteboardWsPath,
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
          whiteboardWsPath,
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
          whiteboardWsPath,
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

          if (type === WHITEBOARD_ERASE_TOPIC) {
            const erased = readUndoPayload(actualPayload)
            if (!erased || erased.clientId === localClientIdRef.current) {
              return
            }
            setStrokes((prev) => prev.filter((item) => item.id !== erased.strokeId))
            localStrokeIdsRef.current.delete(erased.strokeId)
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
  }, [instance?.id])

  useEffect(() => {
    if (!instance?.id || !instance?.mapId) {
      queueMicrotask(() => {
        setMapIntel(null)
        setMapIntelLoadError(null)
      })
      return
    }

    let active = true
    queueMicrotask(() => {
      setMapIntelLoadError(null)
    })

    void getWhiteboardMapIntel(instance.id)
      .then((response) => {
        if (!active) {
          return
        }
        setMapIntel(response)
      })
      .catch((error) => {
        if (!active) {
          return
        }
        setMapIntel(null)
        setMapIntelLoadError(error instanceof Error ? error.message : t('mapInstance.mapIntelLoadError'))
      })

    return () => {
      active = false
    }
  }, [instance?.id, instance?.mapId, t])

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

  const eraseStrokeAtPoint = useCallback(
    (point: Point) => {
      const eraseTolerance = Math.max(brushWidth / 2, 12) / viewport.scale
      const target = [...strokes]
        .reverse()
        .find(
          (stroke) =>
            !erasedStrokeIdsRef.current.has(stroke.id) && isPointNearStroke(point, stroke, eraseTolerance)
        )

      if (!target) {
        return false
      }

      erasedStrokeIdsRef.current.add(target.id)
      setStrokes((prev) => prev.filter((item) => item.id !== target.id))
      localStrokeIdsRef.current.delete(target.id)
      sendWsMessage({
        type: WHITEBOARD_ERASE_TOPIC,
        payload: {
          strokeId: target.id,
          clientId: localClientIdRef.current,
        },
      })
      return true
    },
    [brushWidth, sendWsMessage, strokes, viewport.scale]
  )

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
    pointerModeRef.current = isPan ? 'pan' : toolMode === 'erase' ? 'erase' : 'draw'
    activePointerIdRef.current = event.pointerId

    if (pointerModeRef.current === 'pan') {
      panAnchorRef.current = {
        x: event.clientX,
        y: event.clientY,
        startX: viewport.x,
        startY: viewport.y,
      }
    } else if (pointerModeRef.current === 'erase') {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) {
        return
      }
      erasedStrokeIdsRef.current.clear()
      eraseStrokeAtPoint(point)
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

    if (pointerModeRef.current === 'erase') {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (point) {
        eraseStrokeAtPoint(point)
      }
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
    if (pointerModeRef.current === 'erase') {
      erasedStrokeIdsRef.current.clear()
    }
    pointerModeRef.current = null
    activePointerIdRef.current = null
    panAnchorRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onPointerLeave: React.PointerEventHandler<HTMLDivElement> = () => {
    if (pointerModeRef.current === 'erase') {
      erasedStrokeIdsRef.current.clear()
    }
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
    const scaleFactor = clamp(
      Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY),
      WHEEL_ZOOM_FACTOR_MIN,
      WHEEL_ZOOM_FACTOR_MAX,
    )

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

  const renderExtraDetails = useCallback(
    (details: Array<{ label: string; value: string }>) => {
      if (details.length === 0) {
        return null
      }

      return (
        <dl className="grid gap-2 sm:grid-cols-2">
          {details.map((detail) => (
            <div
              key={`${detail.label}-${detail.value}`}
              className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2"
            >
              <dt className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{detail.label}</dt>
              <dd className="mt-1 break-words text-[11px] leading-5 text-slate-200">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )
    },
    [],
  )

  const renderSectionToggle = useCallback(
    (
      label: string,
      meta: string,
      open: boolean,
      onToggle: () => void,
      stickyClassName = '',
    ) => {
      return (
        <button
          type="button"
          onClick={onToggle}
          className={[
            'flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/92 px-4 py-3 text-left shadow-[0_10px_30px_rgba(2,6,23,0.22)] backdrop-blur-md transition hover:border-slate-500/80 hover:bg-slate-900/95',
            stickyClassName,
          ].join(' ')}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-[0.01em] text-white">{label}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{meta}</div>
          </div>
          <span className="shrink-0 rounded-full border border-slate-600/80 bg-slate-900/90 px-2.5 py-1 text-[11px] font-medium text-slate-200">
            {open ? '−' : '+'}
          </span>
        </button>
      )
    },
    [],
  )

  const renderExtractionCard = useCallback(
    (item: ExtractionIntelItem) => {
      return (
        <article
          key={item.id}
          className="overflow-hidden rounded-[1.45rem] border border-slate-700/80 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] p-4 text-xs text-slate-200 shadow-[0_22px_50px_rgba(2,6,23,0.24)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">{t('mapInstance.extractionsTitle')}</p>
              <h4 className="mt-1 text-base font-semibold leading-6 text-white">{item.name}</h4>
              {item.location && <p className="mt-1 text-[12px] text-slate-400">{item.location}</p>}
              {item.factions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.factions.map((faction, index) => (
                    <span
                      key={faction}
                      className={['rounded-full border px-2 py-0.5 text-[11px]', getIntelTagTone(index)].join(' ')}
                    >
                      {faction}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-2 text-right text-[11px] text-slate-300">
              <span className="rounded-full border border-slate-600/80 bg-slate-900/85 px-3 py-1 font-medium">
                {t('mapInstance.alwaysAvailable')}: {renderIntelBool(item.alwaysAvailable, t)}
              </span>
              <span className="rounded-full border border-slate-600/80 bg-slate-900/85 px-3 py-1 font-medium">
                {t('mapInstance.oneTime')}: {renderIntelBool(item.oneTime, t)}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-[12px] text-slate-300">
            {item.requirement && (
              <p className="rounded-xl border border-amber-300/20 bg-amber-400/8 px-3 py-2.5 leading-5">
                <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-amber-200/70">{t('mapInstance.requirement')}</span>
                <span className="text-slate-100">{item.requirement}</span>
              </p>
            )}
            {item.description && (
              <p className="rounded-xl border border-slate-700/70 bg-slate-900/55 px-3 py-2.5 leading-6">
                <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">{t('mapInstance.description')}</span>
                <span className="text-slate-200">{item.description}</span>
              </p>
            )}
            {renderExtraDetails(item.extraDetails)}
          </div>

          {item.detailUrl && (
            <a
              href={item.detailUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-medium text-cyan-100"
            >
              查看详情页
            </a>
          )}

          {item.detailImageUrls.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-700/70">
              <img
                src={item.detailImageUrls[0]}
                alt={`${item.name}-${t('mapInstance.detailImage')}`}
                className="block max-h-48 w-full object-cover"
                loading="lazy"
              />
              {item.detailImageUrls.length > 1 && (
                <div className="border-t border-slate-700/70 px-3 py-2 text-[10px] text-slate-400">
                  {t('mapInstance.detailImage')} {item.detailImageUrls.length} 张
                </div>
              )}
            </div>
          )}
        </article>
      )
    },
    [renderExtraDetails, t],
  )

  const renderLootCard = useCallback(
    (item: HighValueLootIntelItem) => {
      return (
        <article
          key={item.id}
          className="overflow-hidden rounded-[1.45rem] border border-slate-700/80 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.13),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] p-4 text-xs text-slate-200 shadow-[0_22px_50px_rgba(2,6,23,0.24)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70">{t('mapInstance.highValueLootTitle')}</p>
              <h4 className="mt-1 text-base font-semibold leading-6 text-white">{item.title}</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.category && (
                  <span className="inline-flex rounded-full border border-amber-300/35 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-100">
                    {item.category}
                  </span>
                )}
                {item.priority && (
                  <span className="inline-flex rounded-full border border-rose-300/35 bg-rose-400/10 px-2.5 py-1 text-[11px] font-medium text-rose-100">
                    {item.priority}
                  </span>
                )}
              </div>
            </div>
            {item.keyNames.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {item.keyNames.map((keyName) => (
                  <span
                    key={keyName}
                    className="rounded-full border border-lime-300/30 bg-lime-400/10 px-2.5 py-1 text-[11px] font-medium text-lime-100"
                  >
                    {keyName}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 text-[12px] text-slate-300">
            {item.location && (
              <p className="rounded-xl border border-slate-700/70 bg-slate-900/55 px-3 py-2.5 leading-5">
                <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">{t('mapInstance.location')}</span>
                <span className="text-slate-100">{item.location}</span>
              </p>
            )}
            {item.itemNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.itemNames.map((lootName, index) => (
                  <span
                    key={lootName}
                    className={['rounded-full border px-2.5 py-1 text-[11px] font-medium', getIntelTagTone(index)].join(' ')}
                  >
                    {lootName}
                  </span>
                ))}
              </div>
            )}
            {item.notes && (
              <p className="rounded-xl border border-slate-700/70 bg-slate-900/55 px-3 py-2.5 leading-6">
                <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">{t('mapInstance.description')}</span>
                <span className="text-slate-200">{item.notes}</span>
              </p>
            )}
            {renderExtraDetails(item.extraDetails)}
          </div>

          {item.imageUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-700/70">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="block max-h-48 w-full object-cover"
                loading="lazy"
              />
            </div>
          )}
        </article>
      )
    },
    [renderExtraDetails, t],
  )

  const renderMapIntelPanel = useCallback((onClose?: () => void) => {
      return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.7rem] border border-slate-700/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.985),rgba(2,6,23,0.96))] px-3 py-3 shadow-[0_28px_70px_rgba(2,6,23,0.38)]">
            <div className="mb-0 shrink-0 rounded-2xl border border-slate-700/80 bg-slate-950/55 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMapIntelPanelOpen((current) => !current)}
                  className="min-w-0 flex-1 text-left transition"
                >
                  <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300/75">Tactical Intel</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{t('mapInstance.mapIntelTitle')}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{t('mapInstance.mapIntelSubtitle')}</p>
                  {(mapIntel?.mapNameZh || mapIntel?.mapNameEn) && (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      {[mapIntel.mapNameZh, mapIntel.mapNameEn].filter(Boolean).join(' / ')}
                    </p>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-slate-600/80 bg-slate-900/90 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                    {mapIntelPanelOpen ? '−' : '+'}
                  </span>
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-base min-h-7 rounded-full border border-slate-600/80 bg-slate-900/85 px-2.5 py-1 text-[11px] text-slate-100"
                    >
                      {t('mapInstance.closeTools')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {mapIntelPanelOpen && <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 scrollbar-tactical">
              {mapIntelLoadError && (
                <div className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {mapIntelLoadError || t('mapInstance.mapIntelLoadError')}
                </div>
              )}

              {mapIntel?.errorMessage && (
                <div className="rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-50">
                  <span className="font-medium">{t('mapInstance.mapIntelModuleError')}:</span>{' '}
                  {mapIntel.errorMessage}
                </div>
              )}

              <section className="space-y-3">
                {renderSectionToggle(
                  t('mapInstance.bossRefreshTitle'),
                  `${(mapIntel?.bossRefresh.regular.length ?? 0) + (mapIntel?.bossRefresh.pve.length ?? 0)} entries`,
                  bossIntelOpen,
                  () => setBossIntelOpen((current) => !current),
                  'sticky top-0 z-30',
                )}
                {bossIntelOpen && (
                  <div className="grid gap-2">
                    {[
                      {
                        key: 'regular',
                        title: t('mapInstance.bossRefreshRegular'),
                        items: mapIntel?.bossRefresh.regular ?? [],
                      },
                      {
                        key: 'pve',
                        title: t('mapInstance.bossRefreshPve'),
                        items: mapIntel?.bossRefresh.pve ?? [],
                      },
                    ].map((group) => (
                      <div key={group.key} className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
                        {group.items.length === 0 ? (
                          <p className="mt-2 text-[11px] text-slate-400">{t('mapInstance.bossRefreshEmpty')}</p>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {group.items.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/70 bg-slate-900/75 px-3 py-3"
                              >
                                <div className="min-w-0">
                                  <span className="block truncate text-[13px] font-semibold text-slate-100">{item.name}</span>
                                  {item.nameSecondary && (
                                    <span className="mt-0.5 block truncate text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                      {item.nameSecondary}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={[
                                    'shrink-0 rounded-2xl px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                                    isGuaranteedSpawnChance(item.chanceText)
                                      ? 'border border-rose-300/40 bg-[linear-gradient(180deg,rgba(251,113,133,0.22),rgba(190,24,93,0.14))]'
                                      : 'border border-amber-300/35 bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(245,158,11,0.12))]',
                                  ].join(' ')}
                                >
                                  <span
                                    className={[
                                      'block text-[10px] uppercase tracking-[0.18em]',
                                      isGuaranteedSpawnChance(item.chanceText)
                                        ? 'text-rose-200/75'
                                        : 'text-amber-200/70',
                                    ].join(' ')}
                                  >
                                    Spawn
                                  </span>
                                  <span
                                    className={[
                                      'block text-[18px] leading-none font-extrabold tabular-nums md:text-[20px]',
                                      isGuaranteedSpawnChance(item.chanceText)
                                        ? 'text-rose-100'
                                        : 'text-amber-100',
                                    ].join(' ')}
                                  >
                                    {item.chanceText}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                {renderSectionToggle(
                  t('mapInstance.extractionsTitle'),
                  `${mapIntel?.extractions.length ?? 0} entries`,
                  extractionsOpen,
                  () => setExtractionsOpen((current) => !current),
                  'sticky top-0 z-20',
                )}
                {extractionsOpen &&
                  (mapIntel?.extractions.length ? (
                    <div className="space-y-3">{mapIntel.extractions.map(renderExtractionCard)}</div>
                  ) : (
                    <p className="rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-[11px] text-slate-400">
                      {t('mapInstance.extractionsEmpty')}
                    </p>
                  ))}
              </section>

              <section className="space-y-3">
                {renderSectionToggle(
                  t('mapInstance.highValueLootTitle'),
                  `${mapIntel?.highValueLoot.length ?? 0} entries`,
                  highValueLootOpen,
                  () => setHighValueLootOpen((current) => !current),
                  'sticky top-0 z-10',
                )}
                {highValueLootOpen &&
                  (mapIntel?.highValueLoot.length ? (
                    <div className="space-y-3">{mapIntel.highValueLoot.map(renderLootCard)}</div>
                  ) : (
                    <p className="rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-[11px] text-slate-400">
                      {t('mapInstance.highValueLootEmpty')}
                    </p>
                  ))}
              </section>
            </div>}
          </div>
      )
    },
    [
      bossIntelOpen,
      extractionsOpen,
      highValueLootOpen,
      mapIntelPanelOpen,
      mapIntel,
      mapIntelLoadError,
      renderExtractionCard,
      renderLootCard,
      renderSectionToggle,
      t,
    ],
  )

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

  const intelDrawer =
    typeof document === 'undefined'
      ? null
      : createPortal(
          <div className={`fixed inset-0 z-[70] ${intelDrawerOpen ? '' : 'pointer-events-none'}`}>
            <button
              type="button"
              aria-label={t('mapInstance.mapIntelTitle')}
              onClick={() => setIntelDrawerOpen(false)}
              className={[
                'absolute inset-0 bg-black/42 backdrop-blur-[1px] transition-opacity duration-150 ease-out',
                intelDrawerOpen ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            />
            <aside
              className={[
                'absolute right-0 top-0 h-full w-full max-w-[min(94vw,34rem)] p-2 md:p-3 transition-transform duration-200 ease-out will-change-transform',
                intelDrawerOpen ? 'translate-x-0' : 'translate-x-[102%]',
              ].join(' ')}
            >
              <div className="h-full transform-gpu">
                {renderMapIntelPanel(() => setIntelDrawerOpen(false))}
              </div>
            </aside>
          </div>,
          document.body,
        )

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIntelDrawerOpen(true)}
              className="btn-base min-h-8 rounded-lg border border-amber-300/45 bg-amber-500/12 px-3 py-1 text-xs text-amber-100"
            >
              {t('mapInstance.mapIntelTitle')}
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
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-600 bg-slate-900/75 p-1">
            <button
              type="button"
              onClick={() => setToolMode('draw')}
              className={[
                'btn-base inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs',
                toolMode === 'draw'
                  ? 'border border-amber-300/45 bg-amber-500/15 text-amber-100'
                  : 'border border-slate-500/60 bg-slate-700/35 text-slate-100 hover:bg-slate-600/45',
              ].join(' ')}
            >
              <FiEdit3 />
              <span>{t('mapInstance.drawTool')}</span>
            </button>
            <button
              type="button"
              onClick={() => setToolMode('erase')}
              className={[
                'btn-base inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs',
                toolMode === 'erase'
                  ? 'border border-rose-300/45 bg-rose-500/15 text-rose-100'
                  : 'border border-slate-500/60 bg-slate-700/35 text-slate-100 hover:bg-slate-600/45',
              ].join(' ')}
            >
              <FiTrash2 />
              <span>{t('mapInstance.eraserTool')}</span>
            </button>
          </div>
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
            onClick={() => fitViewportToContent(contentSize.width, contentSize.height)}
            className="btn-base rounded-lg border border-amber-300/45 bg-amber-500/15 px-3 py-1.5 text-amber-100 hover:bg-amber-400/25"
          >
            {t('mapInstance.resetView')}
          </button>
          <button
            type="button"
            onClick={() => setIntelDrawerOpen(true)}
            className="btn-base rounded-lg border border-amber-300/45 bg-amber-500/12 px-3 py-1.5 text-amber-100 hover:bg-amber-400/25"
          >
            {t('mapInstance.mapIntelTitle')}
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
                onClick={() => setToolMode('draw')}
                className={[
                  'btn-base min-h-8 rounded-lg px-3 py-1.5 text-xs',
                  toolMode === 'draw'
                    ? 'border border-amber-300/45 bg-amber-500/15 text-amber-100'
                    : 'border border-slate-500/60 bg-slate-700/35 text-slate-100',
                ].join(' ')}
              >
                {t('mapInstance.drawTool')}
              </button>
              <button
                type="button"
                onClick={() => setToolMode('erase')}
                className={[
                  'btn-base min-h-8 rounded-lg px-3 py-1.5 text-xs',
                  toolMode === 'erase'
                    ? 'border border-rose-300/45 bg-rose-500/15 text-rose-100'
                    : 'border border-slate-500/60 bg-slate-700/35 text-slate-100',
                ].join(' ')}
              >
                {t('mapInstance.eraserTool')}
              </button>
              <button
                type="button"
                onClick={() => void copyInstanceId()}
                className="btn-base min-h-8 rounded-lg border border-amber-300/45 bg-amber-400/15 px-3 py-1.5 text-xs text-amber-100"
              >
                {copied ? t('mapInstance.copied') : t('mapInstance.copyId')}
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
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
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
            </div>
          </div>
        )}
      </section>

      {intelDrawer}
    </main>
  )
}
