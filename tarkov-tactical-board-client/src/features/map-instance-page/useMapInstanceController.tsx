import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  findMapPreset,
  getMapAssetUrl,
  TARKOV_MAP_PRESETS,
} from '../../constants/maps'
import {
  getWhiteboardInstance,
  getWhiteboardState,
  saveWhiteboardState,
  switchWhiteboardMap,
} from '../../api/whiteboard'
import { saveRecentInstance } from '../../features/recent-instances'
import { getApiBaseUrl } from '../../lib/runtime-config'
import type { MapInstance } from '../../types/map-instance'
import type {
  BoardMarker,
  LocalPoint,
  MapInstanceController,
  MarkerSettingsRequest,
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
const WHITEBOARD_MARKER_ADD_TOPIC = 'marker.add'
const WHITEBOARD_MARKER_REMOVE_TOPIC = 'marker.remove'
const WHITEBOARD_MARKER_UPDATE_TOPIC = 'marker.update'
const STROKE_APPEND_INTERVAL_MS = 40
const WS_RECONNECT_BACKOFF_MS = [1000, 2000, 5000]
const DEFAULT_BRUSH_WIDTH = 22
const DEFAULT_MARKER_FONT_SIZE = 48
const DEFAULT_MARKER_SIZE = 48
const MARKER_LABEL_GAP = 12
const MAX_MARKER_LABEL_LENGTH = 160
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

  const palette = ['#f0c66a', '#42dc93', '#58b7ff', '#ff5f63', '#d977f0', '#f4f7f8']
  return palette[Math.floor(readRandomUnit() * palette.length)]
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

const readMarkerPayload = (payload: unknown): BoardMarker | null => {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as Partial<BoardMarker>
  const id = typeof source.id === 'string' ? source.id.trim() : ''
  const label = typeof source.label === 'string'
    ? source.label.replace(/\r\n?/g, '\n').slice(0, MAX_MARKER_LABEL_LENGTH)
    : ''
  const x = Number(source.x)
  const y = Number(source.y)
  if (!id || !label.trim() || !Number.isFinite(x) || !Number.isFinite(y)) return null
  const fontSize = Number(source.fontSize)
  const markerSize = Number(source.markerSize)
  return {
    id,
    label,
    x,
    y,
    color: source.color || '#f0c66a',
    fontSize: Number.isFinite(fontSize) ? clamp(fontSize, 16, 96) : DEFAULT_MARKER_FONT_SIZE,
    markerSize: Number.isFinite(markerSize) ? clamp(markerSize, 16, 96) : DEFAULT_MARKER_SIZE,
  }
}

type UndoAction =
  | { kind: 'stroke.add'; stroke: Stroke }
  | { kind: 'marker.add'; marker: BoardMarker }
  | { kind: 'marker.remove'; marker: BoardMarker }
  | { kind: 'marker.update'; before: BoardMarker; after: BoardMarker }

const readMarkersFromState = (state: unknown): BoardMarker[] => {
  if (!state || typeof state !== 'object') return []
  const markers = (state as Record<string, unknown>).markers
  if (!Array.isArray(markers)) return []
  return markers.map(readMarkerPayload).filter((item): item is BoardMarker => item !== null)
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
  const { i18n } = useTranslation()
  const isZhLanguage = (i18n.resolvedLanguage ?? i18n.language ?? '').startsWith('zh')
  const mapPresets = TARKOV_MAP_PRESETS
  const [instance, setInstance] = useState<MapInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [switchingMap, setSwitchingMap] = useState(false)
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [markers, setMarkers] = useState<BoardMarker[]>([])
  const [pendingMarkerPoint, setPendingMarkerPoint] = useState<Point | null>(null)
  const [markerSettingsRequest, setMarkerSettingsRequest] = useState<MarkerSettingsRequest | null>(null)
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [toolMode, setToolMode] = useState<ToolMode>('draw')
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [wsConnected, setWsConnected] = useState(false)
  const [contentSize, setContentSize] = useState({ width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT })
  const [brushColor, setBrushColor] = useState(() => generateRandomBrushColor())
  const [brushWidth, setBrushWidth] = useState(DEFAULT_BRUSH_WIDTH)
  const [cursorScale, setCursorScale] = useState(DEFAULT_CURSOR_SCALE)
  const [copied, setCopied] = useState(false)
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({})
  const [remoteInProgressStrokes, setRemoteInProgressStrokes] = useState<Record<string, Stroke>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const localStrokeIdsRef = useRef(new Set<string>())
  const localClientIdRef = useRef(createRealtimeClientId())
  const lastCursorSentAtRef = useRef(0)
  const lastMarkerDragSentAtRef = useRef(0)
  const pointerModeRef = useRef<'draw' | 'erase' | 'pan' | 'pinch' | 'marker-drag' | null>(null)
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
  const erasedMarkerIdsRef = useRef(new Set<string>())
  const markerDragRef = useRef<{
    before: BoardMarker
    current: BoardMarker
    offsetX: number
    offsetY: number
    moved: boolean
  } | null>(null)

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
        setMarkers([])
        setPendingMarkerPoint(null)
        setMarkerSettingsRequest(null)
        setUndoStack([])
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

  const mapUrl = useMemo(() => {
    const matched = findMapPreset(currentMapId)
    return matched ? getMapAssetUrl(matched.mapFileName) : undefined
  }, [currentMapId])

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
              setMarkers([])
              setPendingMarkerPoint(null)
              setMarkerSettingsRequest(null)
              setUndoStack([])
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
          if (type === WHITEBOARD_MARKER_ADD_TOPIC) {
            const marker = readMarkerPayload(actualPayload)
            if (!marker) return
            setMarkers((current) => current.some((item) => item.id === marker.id) ? current : [...current, marker])
            return
          }
          if (type === WHITEBOARD_MARKER_UPDATE_TOPIC) {
            const marker = readMarkerPayload(actualPayload)
            if (!marker) return
            setMarkers((current) => current.map((item) => item.id === marker.id ? marker : item))
            return
          }
          if (type === WHITEBOARD_MARKER_REMOVE_TOPIC) {
            const markerId = actualPayload && typeof actualPayload === 'object'
              ? String((actualPayload as Record<string, unknown>).markerId ?? '')
              : ''
            if (!markerId) return
            setMarkers((current) => current.filter((item) => item.id !== markerId))
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
            setMarkers([])
            setPendingMarkerPoint(null)
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
        setMarkers(readMarkersFromState(response.state))
        setUndoStack([])
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
      void saveWhiteboardState(instance.id, { mapId: instance.mapId, strokes, markers })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [instance?.id, instance?.mapId, markers, strokes])

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

  const findMarkerAtPoint = useCallback((point: Point) => [...markers].reverse().find((marker) => {
    const fontSize = marker.fontSize || DEFAULT_MARKER_FONT_SIZE
    const lines = marker.label.split('\n')
    const longestLineLength = Math.max(...lines.map((line) => line.length), 1)
    const labelWidth = Math.min(520, longestLineLength * fontSize * 0.68)
    const lineHeight = fontSize * 1.2
    const markerRadius = (marker.markerSize || DEFAULT_MARKER_SIZE) / 2
    const labelX = marker.x + markerRadius * 0.72 + MARKER_LABEL_GAP
    const labelBottomY = marker.y - markerRadius * 0.72 - MARKER_LABEL_GAP
    const labelTopY = labelBottomY - lines.length * lineHeight
    const nearPoint = Math.hypot(point.x - marker.x, point.y - marker.y) <= Math.max(marker.markerSize / 2 + 8, 20) / viewport.scale
    const insideLabel = point.x >= labelX
      && point.x <= labelX + labelWidth
      && point.y >= labelTopY
      && point.y <= labelBottomY + fontSize * 0.2
    return nearPoint || insideLabel
  }), [markers, viewport.scale])

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

  const eraseMarkerAtPoint = useCallback((point: Point) => {
    const target = findMarkerAtPoint(point)
    if (target && erasedMarkerIdsRef.current.has(target.id)) return true
    if (!target) return false
    erasedMarkerIdsRef.current.add(target.id)
    setMarkers((current) => current.filter((item) => item.id !== target.id))
    setUndoStack((current) => [...current, { kind: 'marker.remove', marker: target }])
    sendWsMessage({ type: WHITEBOARD_MARKER_REMOVE_TOPIC, payload: { markerId: target.id, clientId: localClientIdRef.current } })
    return true
  }, [findMarkerAtPoint, sendWsMessage])

  const onContextMenu: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
    const point = toWorldPoint(event.clientX, event.clientY)
    if (!point) return
    const marker = findMarkerAtPoint(point)
    if (marker) setMarkerSettingsRequest({ marker, clientX: event.clientX, clientY: event.clientY })
  }

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
    if (!isPan && event.button === 0 && toolMode === 'marker') {
      const point = toWorldPoint(event.clientX, event.clientY)
      const marker = point ? findMarkerAtPoint(point) : undefined
      if (point && marker) {
        pointerModeRef.current = 'marker-drag'
        activePointerIdRef.current = event.pointerId
        markerDragRef.current = {
          before: marker,
          current: marker,
          offsetX: marker.x - point.x,
          offsetY: marker.y - point.y,
          moved: false,
        }
        lastMarkerDragSentAtRef.current = 0
        setMarkerSettingsRequest(null)
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }
    }
    if (!isPan && toolMode === 'marker') {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (point) setPendingMarkerPoint(point)
      return
    }
    pointerModeRef.current = isPan ? 'pan' : toolMode === 'erase' ? 'erase' : 'draw'
    activePointerIdRef.current = event.pointerId
    if (pointerModeRef.current === 'pan') {
      panAnchorRef.current = { x: event.clientX, y: event.clientY, startX: viewport.x, startY: viewport.y }
    } else if (pointerModeRef.current === 'erase') {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) return
      erasedStrokeIdsRef.current.clear()
      erasedMarkerIdsRef.current.clear()
      if (!eraseMarkerAtPoint(point)) eraseStrokeAtPoint(point)
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
      if (point && !eraseMarkerAtPoint(point)) eraseStrokeAtPoint(point)
      return
    }
    if (pointerModeRef.current === 'marker-drag' && markerDragRef.current) {
      const point = toWorldPoint(event.clientX, event.clientY)
      if (!point) return
      const current = {
        ...markerDragRef.current.current,
        x: point.x + markerDragRef.current.offsetX,
        y: point.y + markerDragRef.current.offsetY,
      }
      markerDragRef.current = {
        ...markerDragRef.current,
        current,
        moved: markerDragRef.current.moved
          || Math.hypot(current.x - markerDragRef.current.before.x, current.y - markerDragRef.current.before.y) > 1,
      }
      setMarkers((items) => items.map((item) => item.id === current.id ? current : item))
      const now = Date.now()
      if (now - lastMarkerDragSentAtRef.current >= 40) {
        lastMarkerDragSentAtRef.current = now
        sendWsMessage({
          type: WHITEBOARD_MARKER_UPDATE_TOPIC,
          payload: { ...current, clientId: localClientIdRef.current },
        })
      }
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
    setUndoStack((current) => [...current, { kind: 'stroke.add', stroke }])
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
    if (pointerModeRef.current === 'marker-drag' && markerDragRef.current) {
      const drag = markerDragRef.current
      if (drag.moved) {
        setUndoStack((current) => [...current, { kind: 'marker.update', before: drag.before, after: drag.current }])
        sendWsMessage({ type: WHITEBOARD_MARKER_UPDATE_TOPIC, payload: { ...drag.current, clientId: localClientIdRef.current } })
      }
      markerDragRef.current = null
    }
    if (pointerModeRef.current === 'erase') {
      erasedStrokeIdsRef.current.clear()
      erasedMarkerIdsRef.current.clear()
    }
    pointerModeRef.current = null
    activePointerIdRef.current = null
    panAnchorRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onPointerLeave: React.PointerEventHandler<HTMLDivElement> = () => {
    if (pointerModeRef.current === 'erase') {
      erasedStrokeIdsRef.current.clear()
      erasedMarkerIdsRef.current.clear()
    }
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

  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        fitViewportToContent(contentSize.width, contentSize.height)
      })
    })
    observer.observe(element)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [contentSize.height, contentSize.width, fitViewportToContent])

  const zoomBy = useCallback((factor: number) => {
    const element = containerRef.current
    if (!element) return
    const centerX = element.clientWidth / 2
    const centerY = element.clientHeight / 2
    setViewport((current) => {
      const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE)
      const worldX = (centerX - current.x) / current.scale
      const worldY = (centerY - current.y) / current.scale
      return {
        scale: nextScale,
        x: centerX - worldX * nextScale,
        y: centerY - worldY * nextScale,
      }
    })
  }, [])

  const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy])

  const clearBoard = () => {
    setStrokes([])
    setMarkers([])
    setPendingMarkerPoint(null)
    setCurrentStroke(null)
    setRemoteInProgressStrokes({})
    setMarkerSettingsRequest(null)
    setUndoStack([])
    localStrokeIdsRef.current.clear()
    sendWsMessage({ type: WHITEBOARD_CLEAR_TOPIC, payload: {} })
  }

  const undoLastAction = useCallback(() => {
    const action = undoStack[undoStack.length - 1]
    if (!action) return
    setUndoStack((current) => current.slice(0, -1))
    if (action.kind === 'stroke.add') {
      setStrokes((current) => current.filter((item) => item.id !== action.stroke.id))
      localStrokeIdsRef.current.delete(action.stroke.id)
      sendWsMessage({ type: WHITEBOARD_UNDO_TOPIC, payload: { strokeId: action.stroke.id, clientId: localClientIdRef.current } })
      return
    }
    if (action.kind === 'marker.add') {
      setMarkers((current) => current.filter((item) => item.id !== action.marker.id))
      sendWsMessage({ type: WHITEBOARD_MARKER_REMOVE_TOPIC, payload: { markerId: action.marker.id, clientId: localClientIdRef.current } })
      return
    }
    if (action.kind === 'marker.remove') {
      setMarkers((current) => [...current, action.marker])
      sendWsMessage({ type: WHITEBOARD_MARKER_ADD_TOPIC, payload: { ...action.marker, clientId: localClientIdRef.current } })
      return
    }
    setMarkers((current) => current.map((item) => item.id === action.before.id ? action.before : item))
    sendWsMessage({ type: WHITEBOARD_MARKER_UPDATE_TOPIC, payload: { ...action.before, clientId: localClientIdRef.current } })
  }, [sendWsMessage, undoStack])

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
      if (undoStack.length === 0) return
      event.preventDefault()
      undoLastAction()
    }
    window.addEventListener('keydown', handleUndoHotkey)
    return () => window.removeEventListener('keydown', handleUndoHotkey)
  }, [undoLastAction, undoStack.length])

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

  const addMarker = useCallback((options: Pick<BoardMarker, 'label' | 'color' | 'fontSize' | 'markerSize'>) => {
    const label = options.label.replace(/\r\n?/g, '\n').slice(0, MAX_MARKER_LABEL_LENGTH)
    if (!pendingMarkerPoint || !label.trim()) return
    const marker: BoardMarker = {
      id: `marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: pendingMarkerPoint.x,
      y: pendingMarkerPoint.y,
      label,
      color: options.color || brushColor,
      fontSize: clamp(options.fontSize, 16, 96),
      markerSize: clamp(options.markerSize, 16, 96),
    }
    setMarkers((current) => [...current, marker])
    setUndoStack((current) => [...current, { kind: 'marker.add', marker }])
    setPendingMarkerPoint(null)
    sendWsMessage({ type: WHITEBOARD_MARKER_ADD_TOPIC, payload: { ...marker, clientId: localClientIdRef.current } })
  }, [brushColor, pendingMarkerPoint, sendWsMessage])

  const cancelMarker = useCallback(() => setPendingMarkerPoint(null), [])

  const closeMarkerSettings = useCallback(() => setMarkerSettingsRequest(null), [])

  const updateMarker = useCallback((patch: Pick<BoardMarker, 'id' | 'label' | 'color' | 'fontSize' | 'markerSize'>) => {
    const before = markers.find((item) => item.id === patch.id)
    const label = patch.label.replace(/\r\n?/g, '\n').slice(0, MAX_MARKER_LABEL_LENGTH)
    if (!before || !label.trim()) return
    const after: BoardMarker = {
      ...before,
      label,
      color: patch.color,
      fontSize: clamp(patch.fontSize, 16, 96),
      markerSize: clamp(patch.markerSize, 16, 96),
    }
    if (before.label === after.label && before.color === after.color && before.fontSize === after.fontSize && before.markerSize === after.markerSize) {
      setMarkerSettingsRequest(null)
      return
    }
    setMarkers((current) => current.map((item) => item.id === after.id ? after : item))
    setUndoStack((current) => [...current, { kind: 'marker.update', before, after }])
    setMarkerSettingsRequest(null)
    sendWsMessage({ type: WHITEBOARD_MARKER_UPDATE_TOPIC, payload: { ...after, clientId: localClientIdRef.current } })
  }, [markers, sendWsMessage])

  const deleteMarker = useCallback((markerId: string) => {
    const marker = markers.find((item) => item.id === markerId)
    if (!marker) return
    setMarkers((current) => current.filter((item) => item.id !== markerId))
    setUndoStack((current) => [...current, { kind: 'marker.remove', marker }])
    setMarkerSettingsRequest(null)
    sendWsMessage({ type: WHITEBOARD_MARKER_REMOVE_TOPIC, payload: { markerId, clientId: localClientIdRef.current } })
  }, [markers, sendWsMessage])

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

  const renderedMarkers = useMemo(() => markers.map((marker) => {
    const fontSize = marker.fontSize || DEFAULT_MARKER_FONT_SIZE
    const lines = marker.label.split('\n')
    const markerSize = marker.markerSize || DEFAULT_MARKER_SIZE
    const markerRadius = markerSize / 2
    const lineHeight = fontSize * 1.2
    const labelX = marker.x + markerRadius * 0.72 + MARKER_LABEL_GAP
    const labelBottomY = marker.y - markerRadius * 0.72 - MARKER_LABEL_GAP
    const firstLineY = labelBottomY - (lines.length - 1) * lineHeight
    return (
      <g key={marker.id}>
        <circle
          cx={marker.x}
          cy={marker.y}
          r={markerRadius}
          fill={marker.color}
          style={{ filter: `drop-shadow(0 4px 3px rgba(0,0,0,.95)) drop-shadow(0 0 7px ${marker.color}88)` }}
        />
        <text
          x={labelX}
          y={firstLineY}
          fontSize={fontSize}
          fontWeight={900}
          fontFamily="Roboto Mono, Noto Sans SC, monospace"
          letterSpacing={0}
          fill={marker.color}
          xmlSpace="preserve"
          style={{ filter: `drop-shadow(0 3px 2px rgba(0,0,0,1)) drop-shadow(0 0 6px ${marker.color}88)` }}
        >
          {lines.map((line, index) => (
            <tspan key={`${marker.id}-line-${index}`} x={labelX} dy={index === 0 ? 0 : lineHeight}>{line || ' '}</tspan>
          ))}
        </text>
      </g>
    )
  }), [markers])

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
    window.requestAnimationFrame(() => fitViewportToContent(nextWidth, nextHeight))
  }, [fitViewportToContent])

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
    containerRef,
    renderedStrokes,
    renderedRemoteInProgressStrokes,
    renderedRemoteCursors,
    renderedMarkers,
    pendingMarkerPoint,
    markerSettingsRequest,
    currentMapId,
    currentInstanceId: instance?.id ?? instanceId ?? '',
    resolvedMapLabel: resolveMapLabel(instance?.mapId),
    canUndo: undoStack.length > 0,
    setSelectedMapId,
    setToolMode,
    setBrushColor,
    setBrushWidth,
    setCursorScale,
    handleSwitchMap,
    fitViewportToContent,
    zoomIn,
    zoomOut,
    clearBoard,
    undoLastAction,
    copyInstanceId,
    addMarker,
    cancelMarker,
    updateMarker,
    deleteMarker,
    closeMarkerSettings,
    onContextMenu,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    handleImageLoad,
  }
}
