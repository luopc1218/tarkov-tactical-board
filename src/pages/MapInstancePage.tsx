import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiCopy } from 'react-icons/fi'
import { fetchMapPresets } from '../api/maps'
import { getWhiteboardInstance, getWhiteboardState, saveWhiteboardState } from '../api/whiteboard'
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

const DEFAULT_CANVAS_WIDTH = 1920
const DEFAULT_CANVAS_HEIGHT = 1080
const MIN_SCALE = 0.05
const MAX_SCALE = 8
const WHITEBOARD_STROKE_TOPIC = 'stroke.add'
const WHITEBOARD_STROKE_START_TOPIC = 'stroke.start'
const WHITEBOARD_STROKE_APPEND_TOPIC = 'stroke.append'
const WHITEBOARD_STROKE_END_TOPIC = 'stroke.end'
const WHITEBOARD_CLEAR_TOPIC = 'board.clear'
const WHITEBOARD_UNDO_TOPIC = 'stroke.undo'
const WHITEBOARD_CURSOR_MOVE_TOPIC = 'cursor.move'
const WHITEBOARD_CURSOR_LEAVE_TOPIC = 'cursor.leave'
const STROKE_APPEND_INTERVAL_MS = 40

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
  if (/^wss?:\/\//i.test(wsPath)) {
    return wsPath
  }

  if (/^https?:\/\//i.test(wsPath)) {
    return wsPath.replace(/^http/i, 'ws')
  }

  const wsBase = import.meta.env.VITE_WS_BASE_URL
  if (wsBase) {
    const base = new URL(wsBase)
    const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
    return new URL(wsPath, `${protocol}//${base.host}`).toString()
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return new URL(wsPath, `${protocol}//${window.location.host}`).toString()
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
    : state && typeof state === 'object' && Array.isArray((state as Record<string, unknown>).strokes)
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
    label: typeof source.label === 'string' && source.label.trim() ? source.label.trim() : `User-${clientId.slice(0, 4)}`,
    color: typeof source.color === 'string' && source.color.trim() ? source.color.trim() : colorFromId(clientId),
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

const readStrokeStreamPayload = (payload: unknown): {
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
  const { t } = useTranslation()
  const localClientId = useId().replace(/:/g, '')
  const [instance, setInstance] = useState<MapInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapUrl, setMapUrl] = useState<string | undefined>(undefined)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [wsConnected, setWsConnected] = useState(false)
  const [contentSize, setContentSize] = useState({ width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT })
  const [brushColor, setBrushColor] = useState('#ff3b30')
  const [brushWidth, setBrushWidth] = useState(16)
  const [cursorScale, setCursorScale] = useState(1.8)
  const [copied, setCopied] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({})
  const [remoteInProgressStrokes, setRemoteInProgressStrokes] = useState<Record<string, Stroke>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const localStrokeIdsRef = useRef(new Set<string>())
  const localClientIdRef = useRef(`c-${localClientId}`)
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

  useEffect(() => {
    currentStrokeRef.current = currentStroke
  }, [currentStroke])

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

  useEffect(() => {
    if (!instance?.mapId) {
      queueMicrotask(() => {
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
        const matched = presets.find((item) => item.mapId === instance.mapId)
        setMapUrl(matched?.mapUrl)
      })
      .catch(() => {
        if (active) {
          setMapUrl(undefined)
        }
      })

    return () => {
      active = false
    }
  }, [instance?.mapId])

  useEffect(() => {
    if (!instance?.wsPath) {
      return
    }

    const ws = new WebSocket(resolveWsUrl(instance.wsPath))
    wsRef.current = ws
    queueMicrotask(() => {
      setWsConnected(false)
    })

    ws.onopen = () => {
      setWsConnected(true)
    }
    ws.onclose = () => {
      setWsConnected(false)
    }
    ws.onerror = () => {
      setWsConnected(false)
    }
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          type?: string
          payload?: unknown
          data?: unknown
        }
        const actualPayload = payload.payload ?? payload.data ?? payload

        if (payload.type === WHITEBOARD_CURSOR_LEAVE_TOPIC) {
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

        if (payload.type === WHITEBOARD_CURSOR_MOVE_TOPIC) {
          const cursor = readCursorPayload(actualPayload)
          if (!cursor || cursor.clientId === localClientIdRef.current) {
            return
          }
          setRemoteCursors((prev) => ({ ...prev, [cursor.clientId]: cursor }))
          return
        }

        if (payload.type === WHITEBOARD_STROKE_START_TOPIC) {
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

        if (payload.type === WHITEBOARD_STROKE_APPEND_TOPIC) {
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

        if (payload.type === WHITEBOARD_STROKE_END_TOPIC) {
          const stream = readStrokeStreamPayload(actualPayload)
          if (!stream || stream.clientId === localClientIdRef.current) {
            return
          }
          setRemoteInProgressStrokes((prev) => {
            const target = prev[stream.strokeId]
            if (!target) {
              return prev
            }
            setStrokes((current) => (current.some((item) => item.id === target.id) ? current : [...current, target]))
            const next = { ...prev }
            delete next[stream.strokeId]
            return next
          })
          return
        }

        if (payload.type === WHITEBOARD_UNDO_TOPIC) {
          const undo = readUndoPayload(actualPayload)
          if (!undo || undo.clientId === localClientIdRef.current) {
            return
          }
          setStrokes((prev) => prev.filter((item) => item.id !== undo.strokeId))
          localStrokeIdsRef.current.delete(undo.strokeId)
          return
        }

        if (payload.type === WHITEBOARD_CLEAR_TOPIC) {
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
        setStrokes((prev) => (prev.some((item) => item.id === remoteStroke.id) ? prev : [...prev, remoteStroke]))
      } catch {
        // Ignore non-JSON messages.
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
      setWsConnected(false)
      setRemoteCursors({})
      setRemoteInProgressStrokes({})
    }
  }, [instance?.wsPath])

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

  const sendWsMessage = (message: Record<string, unknown>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    ws.send(JSON.stringify(message))
  }

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
  }, [clearAppendTimer])

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
      panAnchorRef.current = { x: event.clientX, y: event.clientY, startX: viewport.x, startY: viewport.y }
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

    if (pointerModeRef.current === 'pinch' && activeTouchPointsRef.current.size >= 2 && pinchRef.current) {
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
        const normalizedScale = clamp((distance / pinch.startDistance) * pinch.startScale, MIN_SCALE, MAX_SCALE)
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
    if (pointerModeRef.current === 'pan' && panAnchorRef.current) {
      const deltaX = event.clientX - panAnchorRef.current.x
      const deltaY = event.clientY - panAnchorRef.current.y
      setViewport((prev) => ({
        ...prev,
        x: panAnchorRef.current!.startX + deltaX,
        y: panAnchorRef.current!.startY + deltaY,
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
    sendWsMessage({ type: WHITEBOARD_STROKE_TOPIC, payload: stroke })
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
      MAX_SCALE,
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

  const undoLastStroke = () => {
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
        <circle cx={cursor.x} cy={cursor.y} r={baseRadius} fill={cursor.color} fillOpacity={0.95} stroke="rgba(0,0,0,0.72)" strokeWidth={2.1} />
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
        <text
          x={cursor.x + 10}
          y={cursor.y - 8}
          fontSize={14}
          fontWeight={700}
          fill="#f8fafc"
        >
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
          <p className="mt-3 text-emerald-50/75">{t('mapInstance.notFoundDesc')}</p>
          <button type="button" onClick={onBackHome} className="btn-primary mt-5">
            {t('common.backHome')}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-page box-border h-screen overflow-hidden px-2 pb-2 pt-14 md:px-3 md:pb-3 md:pt-16">
      <section className="mx-auto flex h-full w-full max-w-none flex-col gap-2">
        <div className="panel flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-emerald-50/85 md:hidden">
          <span className="truncate">
            {t('mapInstance.instanceId')}: {instance?.id ?? instanceId}
          </span>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="btn-base min-h-8 rounded-xl border border-emerald-300/45 bg-emerald-400/15 px-3 py-1 text-xs text-emerald-50"
          >
            {t('mapInstance.tools')}
          </button>
        </div>

        <div className="panel hidden flex-wrap items-center gap-3 px-3 py-2 text-sm text-emerald-50/85 md:flex">
          <span className="inline-flex items-center gap-2">
            <span>{t('mapInstance.instanceId')}: {instance?.id ?? instanceId}</span>
            <button
              type="button"
              onClick={() => void copyInstanceId()}
              className="btn-base rounded-lg border border-sky-300/45 bg-sky-400/15 px-2.5 py-1.5 text-xs text-sky-100 hover:bg-sky-300/25"
            >
              <FiCopy />
              <span>{copied ? t('mapInstance.copied') : t('mapInstance.copyId')}</span>
            </button>
          </span>
          <span>{t('mapInstance.mapId')}: {instance?.mapId ?? '-'}</span>
          <span>
            {t('mapInstance.wsStatus')}: {wsConnected ? t('mapInstance.connected') : t('mapInstance.disconnected')}
          </span>
          <span>{t('mapInstance.zoom')}: {Math.round(viewport.scale * 100)}%</span>
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-950/45 px-3 py-1.5">
            <span className="text-xs text-emerald-100/80">{t('mapInstance.brushColor')}</span>
            <input
              type="color"
              value={brushColor}
              onChange={(event) => setBrushColor(event.target.value)}
              className="h-7 w-9 rounded border border-emerald-200/30 bg-transparent p-0"
              aria-label={t('mapInstance.brushColor')}
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-950/45 px-3 py-1.5">
            <span className="text-xs text-emerald-100/80">{t('mapInstance.brushWidth')}</span>
            <input
              type="range"
              min={12}
              max={48}
              step={1}
              value={brushWidth}
              onChange={(event) => setBrushWidth(Number(event.target.value))}
              className="w-24 accent-emerald-300"
              aria-label={t('mapInstance.brushWidth')}
            />
            <span className="w-5 text-right text-xs text-emerald-50">{brushWidth}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-950/45 px-3 py-1.5">
            <span className="text-xs text-emerald-100/80">{t('mapInstance.cursorSize')}</span>
            <input
              type="range"
              min={1}
              max={2.6}
              step={0.1}
              value={cursorScale}
              onChange={(event) => setCursorScale(Number(event.target.value))}
              className="w-24 accent-emerald-300"
              aria-label={t('mapInstance.cursorSize')}
            />
            <span className="w-8 text-right text-xs text-emerald-50">{cursorScale.toFixed(1)}x</span>
          </div>
          <button
            type="button"
            onClick={() => fitViewportToContent(contentSize.width, contentSize.height)}
            className="btn-base rounded-xl border border-cyan-300/45 bg-cyan-400/15 px-3 py-2 text-cyan-100 hover:bg-cyan-300/25"
          >
            {t('mapInstance.resetView')}
          </button>
          <button
            type="button"
            onClick={clearBoard}
            className="btn-base rounded-xl border border-amber-300/45 bg-amber-400/15 px-3 py-2 text-amber-100 hover:bg-amber-300/25"
          >
            {t('mapInstance.clearBoard')}
          </button>
          <button
            type="button"
            onClick={undoLastStroke}
            disabled={strokes.length === 0}
            className="btn-base rounded-xl border border-violet-300/45 bg-violet-400/15 px-3 py-2 text-violet-100 hover:bg-violet-300/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t('mapInstance.undoLastStroke')}
          </button>
          <button
            type="button"
            onClick={onBackHome}
            className="btn-base rounded-xl border border-emerald-300/45 bg-emerald-400/15 px-3 py-2 text-emerald-50 hover:bg-emerald-300/25"
          >
            {t('mapInstance.backToMaps')}
          </button>
        </div>

        <div className={`fixed inset-0 z-40 md:hidden ${mobileDrawerOpen ? '' : 'pointer-events-none'}`}>
          <button
            type="button"
            aria-label={t('mapInstance.closeTools')}
            onClick={() => setMobileDrawerOpen(false)}
            className={`absolute inset-0 bg-black/45 transition-opacity ${mobileDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
          />
          <div
            className={`absolute inset-x-0 bottom-0 rounded-t-3xl border border-emerald-300/35 bg-[#0a1712] px-4 pb-5 pt-4 transition-transform duration-200 ${mobileDrawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-emerald-50">{t('mapInstance.tools')}</p>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="btn-base min-h-8 rounded-lg border border-emerald-300/45 bg-emerald-400/15 px-2.5 py-1 text-xs text-emerald-50"
              >
                {t('mapInstance.closeTools')}
              </button>
            </div>

            <div className="space-y-2 text-xs text-emerald-100/85">
              <p>{t('mapInstance.instanceId')}: {instance?.id ?? instanceId}</p>
              <p>{t('mapInstance.mapId')}: {instance?.mapId ?? '-'}</p>
              <p>{t('mapInstance.zoom')}: {Math.round(viewport.scale * 100)}%</p>
              <p>{t('mapInstance.wsStatus')}: {wsConnected ? t('mapInstance.connected') : t('mapInstance.disconnected')}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copyInstanceId()}
                className="btn-base min-h-9 rounded-xl border border-sky-300/45 bg-sky-400/15 px-3 py-2 text-xs text-sky-100"
              >
                {copied ? t('mapInstance.copied') : t('mapInstance.copyId')}
              </button>
              <button
                type="button"
                onClick={() => {
                  fitViewportToContent(contentSize.width, contentSize.height)
                  setMobileDrawerOpen(false)
                }}
                className="btn-base min-h-9 rounded-xl border border-cyan-300/45 bg-cyan-400/15 px-3 py-2 text-xs text-cyan-100"
              >
                {t('mapInstance.resetView')}
              </button>
              <button
                type="button"
                onClick={clearBoard}
                className="btn-base min-h-9 rounded-xl border border-amber-300/45 bg-amber-400/15 px-3 py-2 text-xs text-amber-100"
              >
                {t('mapInstance.clearBoard')}
              </button>
              <button
                type="button"
                onClick={undoLastStroke}
                disabled={strokes.length === 0}
                className="btn-base min-h-9 rounded-xl border border-violet-300/45 bg-violet-400/15 px-3 py-2 text-xs text-violet-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t('mapInstance.undoLastStroke')}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-950/45 px-3 py-2">
              <span className="text-xs text-emerald-100/80">{t('mapInstance.brushColor')}</span>
              <input
                type="color"
                value={brushColor}
                onChange={(event) => setBrushColor(event.target.value)}
                className="h-8 w-full rounded border border-emerald-200/30 bg-transparent p-0"
                aria-label={t('mapInstance.brushColor')}
              />
              <span />
            </div>

            <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-950/45 px-3 py-2">
              <span className="text-xs text-emerald-100/80">{t('mapInstance.brushWidth')}</span>
              <input
                type="range"
                min={12}
                max={48}
                step={1}
                value={brushWidth}
                onChange={(event) => setBrushWidth(Number(event.target.value))}
                className="w-full accent-emerald-300"
                aria-label={t('mapInstance.brushWidth')}
              />
              <span className="w-6 text-right text-xs text-emerald-50">{brushWidth}</span>
            </div>

            <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-950/45 px-3 py-2">
              <span className="text-xs text-emerald-100/80">{t('mapInstance.cursorSize')}</span>
              <input
                type="range"
                min={1}
                max={2.6}
                step={0.1}
                value={cursorScale}
                onChange={(event) => setCursorScale(Number(event.target.value))}
                className="w-full accent-emerald-300"
                aria-label={t('mapInstance.cursorSize')}
              />
              <span className="w-10 text-right text-xs text-emerald-50">{cursorScale.toFixed(1)}x</span>
            </div>

            <button
              type="button"
              onClick={onBackHome}
              className="btn-base mt-3 min-h-9 w-full rounded-xl border border-emerald-300/45 bg-emerald-400/15 px-3 py-2 text-xs text-emerald-50"
            >
              {t('mapInstance.backToMaps')}
            </button>
          </div>
        </div>

        {loading && (
          <div className="panel px-4 py-3 text-sm text-emerald-100/80">{t('common.loading')}</div>
        )}

        {!loading && (
          <div
            ref={containerRef}
            className="relative min-h-0 flex-1 w-full touch-none overflow-hidden rounded-2xl border border-emerald-300/35 bg-[#08120e]"
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
          >
            <div
              className="absolute left-0 top-0"
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
                <div className="grid h-full w-full place-items-center bg-[linear-gradient(120deg,#0d1d17,#1a3026)] text-emerald-100/80">
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
        )}
      </section>
    </main>
  )
}
