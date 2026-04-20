import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Card, CardContent, CardMedia, Chip, Link, Stack, Typography } from '@mui/material'
import type { TarkovMapPreset } from '../../constants/maps'
import { fetchMapPresets } from '../../api/maps'
import {
  getWhiteboardMapIntel,
  getWhiteboardInstance,
  getWhiteboardState,
  saveWhiteboardState,
  switchWhiteboardMap,
  type ExtractionIntelItem,
  type MapIntelResponse,
} from '../../api/whiteboard'
import { saveRecentInstance } from '../../features/recent-instances'
import { openExternalUrl } from '../../lib/desktop'
import { getApiBaseUrl } from '../../lib/runtime-config'
import type { MapInstance } from '../../types/map-instance'
import type {
  LocalPoint,
  MapInstanceController,
  Point,
  RemoteCursor,
  Stroke,
  ToolMode,
  Viewport,
} from './types'

// This hook owns the whiteboard session lifecycle: bootstrap instance data, keep websocket state
// in sync, and expose a UI-friendly controller object for the instance detail page.
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
const DEFAULT_BRUSH_WIDTH = 22
const DEFAULT_CURSOR_SCALE = 1.8

// Keep the initial palette vivid so each session feels distinct while remaining visible on dark maps.
const generateRandomBrushColor = () => {
  const readRandomUnit = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint32Array(1)
      crypto.getRandomValues(bytes)
      return bytes[0] / 0xffffffff
    }
    return Math.random()
  }

  const hue = Math.floor(readRandomUnit() * 360)
  const saturation = 78 + Math.floor(readRandomUnit() * 16)
  const lightness = 50 + Math.floor(readRandomUnit() * 10)
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

const buildPathData = (points: Point[]) => {
  if (points.length === 0) return ''
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
  if (stroke.points.length === 0) return false
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
  return `hsl(${Math.abs(hash) % 360} 90% 62%)`
}

// Reuse the configured API base URL so desktop and web deployments resolve to the same backend.
const resolveWsUrl = (wsPath: string) => {
  if (/^wss?:\/\//i.test(wsPath)) return wsPath
  if (/^https?:\/\//i.test(wsPath)) return wsPath.replace(/^http/i, 'ws')
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

const buildWhiteboardWsPath = (instanceId: string) => `/whiteboard/${encodeURIComponent(instanceId)}`

const createRealtimeClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `c-${crypto.randomUUID()}`
  }
  return `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

const readStrokePayload = (payload: unknown): Stroke | null => {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as Partial<Stroke>
  if (!source.id || !Array.isArray(source.points) || source.points.length === 0) return null
  const points = source.points
    .map((point) => {
      if (!point || typeof point !== 'object') return null
      const x = Number((point as Point).x)
      const y = Number((point as Point).y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      return { x, y }
    })
    .filter((point): point is Point => point !== null)
  if (points.length === 0) return null
  return {
    id: source.id,
    points,
    color: source.color || '#22d3ee',
    width: Number.isFinite(source.width) ? Number(source.width) : DEFAULT_BRUSH_WIDTH,
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
  return strokeList.map((item) => readStrokePayload(item)).filter((item): item is Stroke => item !== null)
}

const readCursorPayload = (payload: unknown): RemoteCursor | null => {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as { clientId?: unknown; x?: unknown; y?: unknown; label?: unknown; color?: unknown }
  const clientId = typeof source.clientId === 'string' ? source.clientId.trim() : ''
  const x = Number(source.x)
  const y = Number(source.y)
  if (!clientId || !Number.isFinite(x) || !Number.isFinite(y)) return null
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
  if (!payload || typeof payload !== 'object') return null
  const source = payload as { strokeId?: unknown; clientId?: unknown }
  const strokeId = typeof source.strokeId === 'string' ? source.strokeId.trim() : ''
  if (!strokeId) return null
  return { strokeId, clientId: typeof source.clientId === 'string' ? source.clientId : undefined }
}

const readStrokeStreamPayload = (
  payload: unknown,
): { strokeId: string; clientId?: string; point?: Point; points?: Point[]; color?: string; width?: number } | null => {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as Record<string, unknown>
  const strokeId = typeof source.strokeId === 'string' ? source.strokeId.trim() : ''
  if (!strokeId) return null
  const parsePoint = (value: unknown): Point | null => {
    if (!value || typeof value !== 'object') return null
    const x = Number((value as Record<string, unknown>).x)
    const y = Number((value as Record<string, unknown>).y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
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

const readMapChangedPayload = (payload: unknown): { mapId: number; resetState: boolean } | null => {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as Record<string, unknown>
  const rawMapId = Number(source.mapId ?? source.map_id)
  if (!Number.isFinite(rawMapId) || rawMapId <= 0) return null
  return { mapId: rawMapId, resetState: source.resetState === undefined ? true : Boolean(source.resetState) }
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const pickString = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = readString(source[key])
    if (value) return value
  }
  return null
}

const resolveEventType = (source: Record<string, unknown>) =>
  (
    pickString(source, ['type', 'topic', 'event', 'action', 'name']) ??
    (source.payload && typeof source.payload === 'object'
      ? pickString(source.payload as Record<string, unknown>, ['type', 'topic', 'event', 'action'])
      : null) ??
    (source.data && typeof source.data === 'object'
      ? pickString(source.data as Record<string, unknown>, ['type', 'topic', 'event', 'action'])
      : null) ??
    ''
  ).toLowerCase()

const copyText = async (value: string): Promise<boolean> => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // fall through
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

export function useMapInstanceController(instanceId: string | null): MapInstanceController {
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
  const [contentSize, setContentSize] = useState({ width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT })
  const [brushColor, setBrushColor] = useState(() => generateRandomBrushColor())
  const [brushWidth, setBrushWidth] = useState(DEFAULT_BRUSH_WIDTH)
  const [cursorScale, setCursorScale] = useState(DEFAULT_CURSOR_SCALE)
  const [copied, setCopied] = useState(false)
  const [mapIntel, setMapIntel] = useState<MapIntelResponse | null>(null)
  const [mapIntelLoading, setMapIntelLoading] = useState(false)
  const [mapIntelLoadError, setMapIntelLoadError] = useState<string | null>(null)
  const [bossIntelOpen, setBossIntelOpen] = useState(true)
  const [extractionsOpen, setExtractionsOpen] = useState(true)
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
  const pinchRef = useRef<{ worldX: number; worldY: number; startDistance: number; startScale: number } | null>(null)
  const stateHydratedRef = useRef(false)
  const currentStrokeRef = useRef<Stroke | null>(null)
  const pendingAppendPointsRef = useRef<Point[]>([])
  const appendTimerRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const erasedStrokeIdsRef = useRef(new Set<string>())
  const mapIntelCacheRef = useRef(new Map<string, MapIntelResponse>())
  const mapIntelPendingRequestsRef = useRef(new Map<string, Promise<MapIntelResponse>>())
  const mapIntelRequestSeqRef = useRef(0)

  useEffect(() => {
    currentStrokeRef.current = currentStroke
  }, [currentStroke])

  const resolveMapLabel = useCallback((mapId: number | null | undefined) => {
    if (!mapId) return '-'
    const matched = mapPresets.find((item) => item.id === mapId)
    if (!matched) return String(mapId)
    return isZhLanguage
      ? matched.nameZh?.trim() || String(mapId)
      : matched.nameEn?.trim() || String(mapId)
  }, [isZhLanguage, mapPresets])

  useEffect(() => {
    if (!instance?.id || !instance?.mapId) return
    saveRecentInstance({ instanceId: instance.id, mapName: resolveMapLabel(instance.mapId) })
  }, [instance?.id, instance?.mapId, resolveMapLabel])

  const handleSwitchMap = useCallback(() => {
    if (!instance?.id || !selectedMapId || switchingMap || instance.mapId === selectedMapId) return
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
        console.warn('[MapInstancePage] Switch map failed', { instanceId: instance.id, targetMapId: selectedMapId, error })
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
    queueMicrotask(() => setLoading(true))
    void getWhiteboardInstance(instanceId)
      .then((payload) => {
        if (active) setInstance(payload)
      })
      .catch(() => {
        if (active) setInstance(null)
      })
      .finally(() => {
        if (active) setLoading(false)
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
        if (!active) return
        setMapPresets(presets)
        const matched = presets.find((item) => item.id === currentMapId)
        setMapUrl(matched?.mapFileName)
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
    queueMicrotask(() => setSelectedMapId(instance?.mapId ?? null))
  }, [instance?.mapId])

  useEffect(() => {
    if (!instance?.id) return
    const whiteboardWsPath = buildWhiteboardWsPath(instance.id)
    const resolvedWsUrl = resolveWsUrl(whiteboardWsPath)
    if (!resolvedWsUrl) return
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
      queueMicrotask(() => setWsConnected(false))
      ws.onopen = () => {
        reconnectAttemptRef.current = 0
        clearReconnectTimer()
        setWsConnected(true)
      }
      ws.onclose = () => {
        setWsConnected(false)
        if (wsRef.current === ws) wsRef.current = null
        if (destroyed) return
        const retryDelay = WS_RECONNECT_BACKOFF_MS[Math.min(reconnectAttemptRef.current, WS_RECONNECT_BACKOFF_MS.length - 1)]
        reconnectAttemptRef.current += 1
        clearReconnectTimer()
        reconnectTimerRef.current = window.setTimeout(() => connect(), retryDelay)
      }
      ws.onerror = () => setWsConnected(false)
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as { type?: string; payload?: unknown; data?: unknown }
          const type = resolveEventType(payload as unknown as Record<string, unknown>)
          const actualPayload = payload.payload ?? payload.data ?? payload
          if (type === WHITEBOARD_MAP_CHANGED_TOPIC) {
            const changed = readMapChangedPayload(actualPayload)
            if (!changed) return
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
            if (!leave || leave.clientId === localClientIdRef.current) return
            setRemoteCursors((prev) => {
              const next = { ...prev }
              delete next[leave.clientId]
              return next
            })
            return
          }
          if (type === WHITEBOARD_CURSOR_MOVE_TOPIC) {
            const cursor = readCursorPayload(actualPayload)
            if (!cursor || cursor.clientId === localClientIdRef.current) return
            setRemoteCursors((prev) => ({ ...prev, [cursor.clientId]: cursor }))
            return
          }
          if (type === WHITEBOARD_STROKE_START_TOPIC) {
            const stream = readStrokeStreamPayload(actualPayload)
            if (!stream || stream.clientId === localClientIdRef.current) return
            const firstPoint = stream.point ?? stream.points?.[0]
            if (!firstPoint) return
            setRemoteInProgressStrokes((prev) => ({
              ...prev,
              [stream.strokeId]: {
                id: stream.strokeId,
                points: [firstPoint],
                color: stream.color || '#22d3ee',
                width: stream.width || DEFAULT_BRUSH_WIDTH,
              },
            }))
            return
          }
          if (type === WHITEBOARD_STROKE_APPEND_TOPIC) {
            const stream = readStrokeStreamPayload(actualPayload)
            if (!stream || stream.clientId === localClientIdRef.current) return
            const nextPoints = stream.points ?? (stream.point ? [stream.point] : [])
            if (nextPoints.length === 0) return
            setRemoteInProgressStrokes((prev) => {
              const target = prev[stream.strokeId]
              if (!target) {
                return {
                  ...prev,
                  [stream.strokeId]: {
                    id: stream.strokeId,
                    points: nextPoints,
                    color: stream.color || '#22d3ee',
                    width: stream.width || DEFAULT_BRUSH_WIDTH,
                  },
                }
              }
              return { ...prev, [stream.strokeId]: { ...target, points: [...target.points, ...nextPoints] } }
            })
            return
          }
          if (type === WHITEBOARD_STROKE_END_TOPIC) {
            const stream = readStrokeStreamPayload(actualPayload)
            if (!stream || stream.clientId === localClientIdRef.current) return
            setRemoteInProgressStrokes((prev) => {
              const target = prev[stream.strokeId]
              if (!target) return prev
              setStrokes((current) => (current.some((item) => item.id === target.id) ? current : [...current, target]))
              const next = { ...prev }
              delete next[stream.strokeId]
              return next
            })
            return
          }
          if (type === WHITEBOARD_UNDO_TOPIC || type === WHITEBOARD_ERASE_TOPIC) {
            const undo = readUndoPayload(actualPayload)
            if (!undo || undo.clientId === localClientIdRef.current) return
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
          if (!remoteStroke || localStrokeIdsRef.current.has(remoteStroke.id)) return
          setRemoteInProgressStrokes((prev) => {
            if (!prev[remoteStroke.id]) return prev
            const next = { ...prev }
            delete next[remoteStroke.id]
            return next
          })
          setStrokes((prev) => (prev.some((item) => item.id === remoteStroke.id) ? prev : [...prev, remoteStroke]))
        } catch {
          // ignore
        }
      }
    }
    reconnectAttemptRef.current = 0
    clearReconnectTimer()
    connect()
    return () => {
      destroyed = true
      clearReconnectTimer()
      wsRef.current?.close()
      wsRef.current = null
      setWsConnected(false)
      setRemoteCursors({})
      setRemoteInProgressStrokes({})
    }
  }, [instance?.id])

  useEffect(() => {
    const cacheKey =
      instance?.id && instance?.mapId ? `${instance.id}:${instance.mapId}` : null
    setMapIntel(cacheKey ? mapIntelCacheRef.current.get(cacheKey) ?? null : null)
    setMapIntelLoadError(null)
    setMapIntelLoading(false)
  }, [instance?.id, instance?.mapId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemoteCursors((prev) => {
        const now = Date.now()
        const nextEntries = Object.values(prev).filter((item) => now - item.updatedAt <= 6000)
        if (nextEntries.length === Object.keys(prev).length) return prev
        return Object.fromEntries(nextEntries.map((item) => [item.clientId, item]))
      })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!instance?.id) return
    let active = true
    stateHydratedRef.current = false
    void getWhiteboardState(instance.id)
      .then((response) => {
        if (!active) return
        setStrokes(readStrokesFromState(response.state))
        stateHydratedRef.current = true
      })
      .catch(() => {
        if (active) stateHydratedRef.current = true
      })
    return () => {
      active = false
    }
  }, [instance?.id])

  useEffect(() => {
    if (!instance?.id || !stateHydratedRef.current) return
    const timer = window.setTimeout(() => {
      void saveWhiteboardState(instance.id, { mapId: instance.mapId, strokes })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [instance?.id, instance?.mapId, strokes])

  const sendWsMessage = useCallback((message: Record<string, unknown>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
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
    sendWsMessage({ type: WHITEBOARD_STROKE_APPEND_TOPIC, payload: { strokeId: stroke.id, points, clientId: localClientIdRef.current, color: stroke.color, width: stroke.width } })
  }, [clearAppendTimer, sendWsMessage])

  const scheduleStrokeAppend = useCallback(() => {
    if (appendTimerRef.current !== null) return
    appendTimerRef.current = window.setTimeout(() => flushStrokeAppend(), STROKE_APPEND_INTERVAL_MS)
  }, [flushStrokeAppend])

  const toWorldPoint = (clientX: number, clientY: number): Point | null => {
    const element = containerRef.current
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { x: (clientX - rect.left - viewport.x) / viewport.scale, y: (clientY - rect.top - viewport.y) / viewport.scale }
  }

  const toLocalPoint = (clientX: number, clientY: number): LocalPoint | null => {
    const element = containerRef.current
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  // Erasing walks the latest strokes first so the top-most path under the pointer is removed.
  const eraseStrokeAtPoint = useCallback((point: Point) => {
    const eraseTolerance = Math.max(brushWidth / 2, 12) / viewport.scale
    const target = [...strokes].reverse().find((stroke) => !erasedStrokeIdsRef.current.has(stroke.id) && isPointNearStroke(point, stroke, eraseTolerance))
    if (!target) return false
    erasedStrokeIdsRef.current.add(target.id)
    setStrokes((prev) => prev.filter((item) => item.id !== target.id))
    localStrokeIdsRef.current.delete(target.id)
    sendWsMessage({ type: WHITEBOARD_ERASE_TOPIC, payload: { strokeId: target.id, clientId: localClientIdRef.current } })
    return true
  }, [brushWidth, sendWsMessage, strokes, viewport.scale])

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.cancelable) event.preventDefault()
    const isTouch = event.pointerType === 'touch'
    if (isTouch) {
      const localPoint = toLocalPoint(event.clientX, event.clientY)
      if (localPoint) activeTouchPointsRef.current.set(event.pointerId, localPoint)
    }
    if (isTouch && activeTouchPointsRef.current.size >= 2) {
      if (currentStroke) setCurrentStroke(null)
      const [first, second] = Array.from(activeTouchPointsRef.current.values())
      if (first && second) {
        const center = midpointBetween(first, second)
        const startDistance = distanceBetween(first, second)
        pinchRef.current = {
          worldX: (center.x - viewport.x) / viewport.scale,
          worldY: (center.y - viewport.y) / viewport.scale,
          startDistance: startDistance > 0 ? startDistance : 1,
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
      panAnchorRef.current = { x: event.clientX, y: event.clientY, startX: viewport.x, startY: viewport.y }
    } else if (pointerModeRef.current === 'erase') {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) return
      erasedStrokeIdsRef.current.clear()
      eraseStrokeAtPoint(point)
    } else {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) return
      const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setCurrentStroke({ id: strokeId, points: [point], color: brushColor, width: brushWidth })
      sendWsMessage({ type: WHITEBOARD_STROKE_START_TOPIC, payload: { strokeId, point, color: brushColor, width: brushWidth, clientId: localClientIdRef.current } })
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    const worldPointForCursor = toWorldPoint(event.clientX, event.clientY)
    if (worldPointForCursor) {
      const now = Date.now()
      if (now - lastCursorSentAtRef.current > 40) {
        lastCursorSentAtRef.current = now
        sendWsMessage({ type: WHITEBOARD_CURSOR_MOVE_TOPIC, payload: { clientId: localClientIdRef.current, x: worldPointForCursor.x, y: worldPointForCursor.y, label: localClientIdRef.current.slice(0, 4).toUpperCase(), color: colorFromId(localClientIdRef.current) } })
      }
    }
    if (event.pointerType === 'touch') {
      const localPoint = toLocalPoint(event.clientX, event.clientY)
      if (localPoint) activeTouchPointsRef.current.set(event.pointerId, localPoint)
    }
    if (pointerModeRef.current === 'pinch' && activeTouchPointsRef.current.size >= 2 && pinchRef.current) {
      const [first, second] = Array.from(activeTouchPointsRef.current.values())
      if (!first || !second) return
      const center = midpointBetween(first, second)
      const distance = distanceBetween(first, second)
      setViewport(() => {
        const normalizedScale = clamp((distance / pinchRef.current!.startDistance) * pinchRef.current!.startScale, MIN_SCALE, MAX_SCALE)
        return { scale: normalizedScale, x: center.x - pinchRef.current!.worldX * normalizedScale, y: center.y - pinchRef.current!.worldY * normalizedScale }
      })
      return
    }
    if (activePointerIdRef.current !== event.pointerId) return
    const panAnchor = panAnchorRef.current
    if (pointerModeRef.current === 'pan' && panAnchor) {
      const deltaX = event.clientX - panAnchor.x
      const deltaY = event.clientY - panAnchor.y
      setViewport((prev) => ({ ...prev, x: panAnchor.startX + deltaX, y: panAnchor.startY + deltaY }))
      return
    }
    if (pointerModeRef.current === 'erase') {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (point) eraseStrokeAtPoint(point)
      return
    }
    if (pointerModeRef.current !== 'draw' || !currentStroke) return
    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) return
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
    sendWsMessage({ type: WHITEBOARD_STROKE_END_TOPIC, payload: { strokeId: stroke.id, clientId: localClientIdRef.current } })
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
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    if (activePointerIdRef.current !== event.pointerId) return
    if (pointerModeRef.current === 'draw') finishStroke()
    if (pointerModeRef.current === 'erase') erasedStrokeIdsRef.current.clear()
    pointerModeRef.current = null
    activePointerIdRef.current = null
    panAnchorRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onPointerLeave: React.PointerEventHandler<HTMLDivElement> = () => {
    if (pointerModeRef.current === 'erase') erasedStrokeIdsRef.current.clear()
    sendWsMessage({ type: WHITEBOARD_CURSOR_LEAVE_TOPIC, payload: { clientId: localClientIdRef.current, x: 0, y: 0 } })
  }

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const element = containerRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    const scaleFactor = clamp(Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY), WHEEL_ZOOM_FACTOR_MIN, WHEEL_ZOOM_FACTOR_MAX)
    setViewport((prev) => {
      const nextScale = clamp(prev.scale * scaleFactor, MIN_SCALE, MAX_SCALE)
      const worldX = (mouseX - prev.x) / prev.scale
      const worldY = (mouseY - prev.y) / prev.scale
      return { scale: nextScale, x: mouseX - worldX * nextScale, y: mouseY - worldY * nextScale }
    })
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [handleWheel, loading])

  const fitViewportToContent = useCallback((width: number, height: number) => {
    const element = containerRef.current
    if (!element || width <= 0 || height <= 0) return
    const containerWidth = element.clientWidth
    const containerHeight = element.clientHeight
    if (containerWidth <= 0 || containerHeight <= 0) return
    const nextScale = clamp(Math.min(containerWidth / width, containerHeight / height), MIN_SCALE, MAX_SCALE)
    setViewport({ x: (containerWidth - width * nextScale) / 2, y: (containerHeight - height * nextScale) / 2, scale: nextScale })
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
    if (!removed) return
    setStrokes((prev) => prev.slice(0, -1))
    localStrokeIdsRef.current.delete(removed.id)
    sendWsMessage({ type: WHITEBOARD_UNDO_TOPIC, payload: { strokeId: removed.id, clientId: localClientIdRef.current } })
  }, [sendWsMessage, strokes])

  useEffect(() => {
    const handleUndoHotkey = (event: KeyboardEvent) => {
      const isUndoKey = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey
      if (!isUndoKey || event.key.toLowerCase() !== 'z') return
      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName
        const isEditable = target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
        if (isEditable) return
      }
      if (strokes.length === 0) return
      event.preventDefault()
      undoLastStroke()
    }
    window.addEventListener('keydown', handleUndoHotkey)
    return () => window.removeEventListener('keydown', handleUndoHotkey)
  }, [strokes.length, undoLastStroke])

  const copyInstanceId = useCallback(async () => {
    const value = instance?.id ?? instanceId
    if (!value) return
    const ok = await copyText(value)
    if (!ok) {
      setCopied(false)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }, [instance?.id, instanceId])

  const loadMapIntel = useCallback(async () => {
    if (!instance?.id || !instance?.mapId) {
      setMapIntel(null)
      setMapIntelLoadError(null)
      return
    }

    const cacheKey = `${instance.id}:${instance.mapId}`
    const cachedIntel = mapIntelCacheRef.current.get(cacheKey)
    if (cachedIntel) {
      setMapIntel(cachedIntel)
    }

    const requestId = mapIntelRequestSeqRef.current + 1
    mapIntelRequestSeqRef.current = requestId

    setMapIntelLoading(true)
    setMapIntelLoadError(null)
    try {
      let pendingRequest = mapIntelPendingRequestsRef.current.get(cacheKey)
      if (!pendingRequest) {
        pendingRequest = getWhiteboardMapIntel(instance.id)
        mapIntelPendingRequestsRef.current.set(cacheKey, pendingRequest)
      }
      const response = await pendingRequest
      mapIntelCacheRef.current.set(cacheKey, response)
      if (mapIntelRequestSeqRef.current !== requestId) {
        return
      }
      setMapIntel(response)
    } catch (error) {
      if (mapIntelRequestSeqRef.current !== requestId) {
        return
      }
      if (!cachedIntel) {
        setMapIntel(null)
      }
      setMapIntelLoadError(error instanceof Error ? error.message : t('mapInstance.mapIntelLoadError'))
    } finally {
      const activePendingRequest = mapIntelPendingRequestsRef.current.get(cacheKey)
      if (activePendingRequest) {
        void activePendingRequest.finally(() => {
          if (mapIntelPendingRequestsRef.current.get(cacheKey) === activePendingRequest) {
            mapIntelPendingRequestsRef.current.delete(cacheKey)
          }
        })
      }
      if (mapIntelRequestSeqRef.current === requestId) {
        setMapIntelLoading(false)
      }
    }
  }, [instance?.id, instance?.mapId, t])

  // Local strokes render the current in-progress path together with the confirmed history.
  const renderedStrokes = useMemo(() => {
    const list = currentStroke ? [...strokes, currentStroke] : strokes
    return list.map((stroke) => (
      <path key={stroke.id} d={buildPathData(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />
    ))
  }, [currentStroke, strokes])

  const renderedRemoteInProgressStrokes = useMemo(
    () =>
      Object.values(remoteInProgressStrokes).map((stroke) => (
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
      )),
    [remoteInProgressStrokes],
  )

  // "Cursor size" only affects the collaborative remote pointer overlay, not the system cursor.
  const renderedRemoteCursors = useMemo(() => {
    const baseRadius = 7 * cursorScale
    const ringRadius = baseRadius + 4
    return Object.values(remoteCursors).map((cursor) => (
      <g key={cursor.clientId}>
        <circle cx={cursor.x} cy={cursor.y} r={ringRadius} fill="none" stroke="rgba(255,255,255,0.96)" strokeWidth={2.6} />
        <circle cx={cursor.x} cy={cursor.y} r={ringRadius + 2} fill="none" stroke="rgba(0,0,0,0.65)" strokeWidth={1.4} />
        <line x1={cursor.x - ringRadius - 5} y1={cursor.y} x2={cursor.x + ringRadius + 5} y2={cursor.y} stroke="rgba(255,255,255,0.72)" strokeWidth={1.5} />
        <line x1={cursor.x} y1={cursor.y - ringRadius - 5} x2={cursor.x} y2={cursor.y + ringRadius + 5} stroke="rgba(255,255,255,0.72)" strokeWidth={1.5} />
        <circle cx={cursor.x} cy={cursor.y} r={baseRadius} fill={cursor.color} fillOpacity={0.95} stroke="rgba(0,0,0,0.72)" strokeWidth={2.1} />
        <rect x={cursor.x + 12} y={cursor.y - 22} rx={6} ry={6} width={Math.max(56, cursor.label.length * 9)} height={20} fill="rgba(0,0,0,0.66)" stroke={cursor.color} strokeWidth={1.1} />
        <text x={cursor.x + 10} y={cursor.y - 8} fontSize={14} fontWeight={700} fill="#f8fafc">{cursor.label}</text>
      </g>
    ))
  }, [cursorScale, remoteCursors])

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget
    const nextWidth = image.naturalWidth || DEFAULT_CANVAS_WIDTH
    const nextHeight = image.naturalHeight || DEFAULT_CANVAS_HEIGHT
    setContentSize({ width: nextWidth, height: nextHeight })
    fitViewportToContent(nextWidth, nextHeight)
  }, [fitViewportToContent])

  const renderIntelBool = useCallback((value: boolean | null) => {
    if (value === null) return t('mapInstance.notProvided')
    return value ? t('mapInstance.yes') : t('mapInstance.no')
  }, [t])

  const getIntelTagColor = useCallback((index: number): 'info' | 'warning' | 'success' | 'secondary' => {
    const tones: Array<'info' | 'warning' | 'success' | 'secondary'> = ['info', 'warning', 'success', 'secondary']
    return tones[index % tones.length]
  }, [])

  const isGuaranteedSpawnChance = useCallback((value: string) => value.replace(/\s+/g, '').trim() === '100%', [])

  const renderExtraDetails = useCallback((details: Array<{ label: string; value: string }>) => {
    if (details.length === 0) return null
    return (
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {details.map((detail) => (
          <Chip key={`${detail.label}-${detail.value}`} label={`${detail.label}: ${detail.value}`} size="small" variant="outlined" />
        ))}
      </Stack>
    )
  }, [])

  const renderExtractionCard = useCallback((item: ExtractionIntelItem) => (
    <Card key={item.id} variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1">{item.name}</Typography>
              {item.location ? <Typography variant="body2" color="text.secondary">{item.location}</Typography> : null}
            </Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Chip
                size="small"
                label={`${t('mapInstance.alwaysAvailableShort')}: ${renderIntelBool(item.alwaysAvailable)}`}
                color="success"
                variant="outlined"
              />
              <Chip
                size="small"
                label={`${t('mapInstance.oneTimeShort')}: ${renderIntelBool(item.oneTime)}`}
                color="warning"
                variant="outlined"
              />
            </Stack>
          </Stack>

          {item.factions.length ? (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {item.factions.map((faction, index) => (
                <Chip key={faction} size="small" label={faction} color={getIntelTagColor(index)} />
              ))}
            </Stack>
          ) : null}

          {item.requirement ? (
            <Typography variant="body2" color="text.secondary">
              <strong>{t('mapInstance.requirement')}:</strong> {item.requirement}
            </Typography>
          ) : null}
          {item.description ? (
            <Typography variant="body2" color="text.secondary">
              <strong>{t('mapInstance.description')}:</strong> {item.description}
            </Typography>
          ) : null}

          {renderExtraDetails(item.extraDetails)}

          {item.detailUrl ? (
            <Link
              component="button"
              type="button"
              onClick={() => void openExternalUrl(item.detailUrl!)}
              underline="hover"
            >
              {t('mapInstance.viewDetails')}
            </Link>
          ) : null}

          {item.detailImageUrls.length > 0 ? (
            <CardMedia component="img" image={item.detailImageUrls[0]} alt={`${item.name}-${t('mapInstance.detailImage')}`} sx={{ borderRadius: 2, maxHeight: 220, objectFit: 'cover' }} />
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  ), [getIntelTagColor, renderExtraDetails, renderIntelBool, t])

  return {
    instance,
    loading,
    mapPresets,
    switchingMap,
    selectedMapId,
    mapUrl,
    toolMode,
    viewport,
    wsConnected,
    contentSize,
    brushColor,
    brushWidth,
    cursorScale,
    copied,
    mapIntel,
    mapIntelLoading,
    mapIntelLoadError,
    bossIntelOpen,
    extractionsOpen,
    containerRef,
    renderedStrokes,
    renderedRemoteInProgressStrokes,
    renderedRemoteCursors,
    currentMapId,
    currentInstanceId: instance?.id ?? instanceId ?? '',
    resolvedMapLabel: resolveMapLabel(instance?.mapId),
    canUndo: strokes.length > 0,
    setSelectedMapId,
    setToolMode,
    setBrushColor,
    setBrushWidth,
    setCursorScale,
    setBossIntelOpen,
    setExtractionsOpen,
    loadMapIntel,
    handleSwitchMap,
    fitViewportToContent,
    clearBoard,
    undoLastStroke,
    copyInstanceId,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    handleImageLoad,
    renderIntelBool,
    isGuaranteedSpawnChance,
    getIntelTagColor,
    renderExtractionCard,
  }
}
