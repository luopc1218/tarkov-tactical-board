import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const DEFAULT_CANVAS_WIDTH = 1920
const DEFAULT_CANVAS_HEIGHT = 1080
const MIN_SCALE = 0.2
const MAX_SCALE = 8
const WHITEBOARD_STROKE_TOPIC = 'stroke.add'
const WHITEBOARD_CLEAR_TOPIC = 'board.clear'

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

export function MapInstancePage({ instanceId, onBackHome }: MapInstancePageProps) {
  const { t } = useTranslation()
  const [instance, setInstance] = useState<MapInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [mapUrl, setMapUrl] = useState<string | undefined>(undefined)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [wsConnected, setWsConnected] = useState(false)
  const [contentSize, setContentSize] = useState({ width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT })
  const [brushColor, setBrushColor] = useState('#ff3b30')
  const [brushWidth, setBrushWidth] = useState(16)
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const localStrokeIdsRef = useRef(new Set<string>())
  const pointerModeRef = useRef<'draw' | 'pan' | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const panAnchorRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const stateHydratedRef = useRef(false)

  useEffect(() => {
    if (!instanceId) {
      setInstance(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setErrorMessage(null)
    void getWhiteboardInstance(instanceId)
      .then((payload) => {
        if (!active) {
          return
        }
        setInstance(payload)
      })
      .catch((error) => {
        if (!active) {
          return
        }
        setErrorMessage(error instanceof Error ? error.message : t('mapInstance.notFoundDesc'))
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
  }, [instanceId, t])

  useEffect(() => {
    if (!instance?.mapId) {
      setMapUrl(undefined)
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
    setWsConnected(false)

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
        if (payload.type === WHITEBOARD_CLEAR_TOPIC) {
          setStrokes([])
          setCurrentStroke(null)
          localStrokeIdsRef.current.clear()
          return
        }
        const remoteStroke = readStrokePayload(payload.payload ?? payload.data ?? payload)
        if (!remoteStroke || localStrokeIdsRef.current.has(remoteStroke.id)) {
          return
        }
        setStrokes((prev) => (prev.some((item) => item.id === remoteStroke.id) ? prev : [...prev, remoteStroke]))
      } catch {
        // Ignore non-JSON messages.
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
      setWsConnected(false)
    }
  }, [instance?.wsPath])

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

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
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
      setCurrentStroke({
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        points: [point],
        color: brushColor,
        width: brushWidth,
      })
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
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
    setCurrentStroke((prev) => (prev ? { ...prev, points: [...prev.points, point] } : prev))
  }

  const finishStroke = () => {
    if (!currentStroke || currentStroke.points.length < 1) {
      setCurrentStroke(null)
      return
    }
    localStrokeIdsRef.current.add(currentStroke.id)
    setStrokes((prev) => [...prev, currentStroke])
    sendWsMessage({ type: WHITEBOARD_STROKE_TOPIC, payload: currentStroke })
    setCurrentStroke(null)
  }

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
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

  const clearBoard = () => {
    setStrokes([])
    setCurrentStroke(null)
    localStrokeIdsRef.current.clear()
    sendWsMessage({ type: WHITEBOARD_CLEAR_TOPIC, payload: {} })
  }

  const undoLastStroke = () => {
    setStrokes((prev) => {
      if (prev.length === 0) {
        return prev
      }
      const next = prev.slice(0, -1)
      const removed = prev[prev.length - 1]
      if (removed?.id) {
        localStrokeIdsRef.current.delete(removed.id)
      }
      return next
    })
  }

  const copyInstanceId = async () => {
    const value = instance?.id ?? instanceId
    if (!value) {
      return
    }
    try {
      await navigator.clipboard.writeText(value)
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

  if (!instanceId || (!loading && !instance)) {
    return (
      <main className="app-page grid place-items-center px-4 py-8">
        <section className="panel w-full max-w-xl p-6 md:p-8">
          <h1 className="text-3xl font-extrabold text-white">{t('mapInstance.notFoundTitle')}</h1>
          <p className="mt-3 text-emerald-50/75">{errorMessage ?? t('mapInstance.notFoundDesc')}</p>
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
        <div className="panel flex flex-wrap items-center gap-3 px-3 py-2 text-sm text-emerald-50/85">
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
          <button
            type="button"
            onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
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
                    setContentSize({
                      width: image.naturalWidth || DEFAULT_CANVAS_WIDTH,
                      height: image.naturalHeight || DEFAULT_CANVAS_HEIGHT,
                    })
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
              </svg>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
