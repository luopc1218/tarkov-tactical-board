import RadarOutlinedIcon from '@mui/icons-material/RadarOutlined'
import { Box, CircularProgress, Typography } from '@mui/material'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { MapCanvasProps } from '../types'

const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <g transform="rotate(-18 16 16)">
      <path d="M9 11 C9 9.3 10.3 8 12 8 H22 C23.7 8 25 9.3 25 11 V19 C25 20.7 23.7 22 22 22 H12 C10.3 22 9 20.7 9 19 Z" fill="#fca5a5" stroke="#111827" stroke-width="1.6"/>
      <path d="M9 16 H25" stroke="#111827" stroke-width="1.2" stroke-opacity="0.75"/>
      <path d="M12 22 L24 22 L21 26 H9 Z" fill="#e5e7eb" stroke="#111827" stroke-width="1.2" stroke-linejoin="round"/>
    </g>
  </svg>`,
)}") 10 10, cell`

const resolveCanvasCursor = (toolMode: MapCanvasProps['toolMode']) =>
  toolMode === 'erase' ? ERASER_CURSOR : 'crosshair'

// Canvas only renders visuals and pointer plumbing. Session state lives in the controller hook.
export function MapCanvas({
  containerRef,
  contentSize,
  viewport,
  toolMode,
  mapUrl,
  switchingMap = false,
  mapAlt,
  renderedStrokes,
  renderedRemoteInProgressStrokes,
  renderedRemoteCursors,
  renderedMarkers,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onContextMenu,
  onImageLoad,
  emptyLabel,
  loadingLabel,
}: MapCanvasProps) {
  const prefersReducedMotion = useReducedMotion()
  const [displayedMapUrl, setDisplayedMapUrl] = useState<string | undefined>(undefined)
  const [imageLoading, setImageLoading] = useState(Boolean(mapUrl))
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!mapUrl) {
      queueMicrotask(() => {
        setDisplayedMapUrl(undefined)
        setImageLoading(false)
      })
      return
    }
    if (mapUrl === displayedMapUrl) return

    const requestId = ++requestIdRef.current
    const image = new Image()
    queueMicrotask(() => setImageLoading(true))

    const revealImage = () => {
      if (requestId !== requestIdRef.current) return
      setDisplayedMapUrl(mapUrl)
    }

    image.onload = revealImage
    image.onerror = () => {
      if (requestId === requestIdRef.current) setImageLoading(false)
    }
    image.src = mapUrl

    if (typeof image.decode === 'function') {
      void image.decode().then(revealImage).catch(() => undefined)
    }

    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [displayedMapUrl, mapUrl])

  const showLoading = imageLoading || switchingMap

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        minHeight: { xs: '52vh', md: 0 },
        height: '100%',
        width: '100%',
        minWidth: 0,
        flex: 1,
        overflow: 'hidden',
        borderRadius: 0,
        background: '#05090c',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <Box
        ref={containerRef}
        onContextMenu={onContextMenu}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 'inherit',
          overflow: 'hidden',
          cursor: resolveCanvasCursor(toolMode),
        }}
      >
        <Box
          onDragStart={(event) => event.preventDefault()}
          sx={{
            position: 'absolute',
            inset: '0 auto auto 0',
            width: `${contentSize.width}px`,
            height: `${contentSize.height}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {displayedMapUrl ? (
            <Box
              key={displayedMapUrl}
              component="img"
              src={displayedMapUrl}
              alt={mapAlt}
              draggable={false}
              onDragStart={(event: React.DragEvent<HTMLImageElement>) => event.preventDefault()}
              onLoad={(event: React.SyntheticEvent<HTMLImageElement>) => {
                onImageLoad(event)
                setImageLoading(false)
              }}
              sx={{
                pointerEvents: 'none',
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                userSelect: 'none',
                animation: prefersReducedMotion ? 'none' : 'map-canvas-reveal 360ms var(--motion-ease-out)',
              }}
            />
          ) : (
            <Box
              sx={{
                display: 'grid',
                width: '100%',
                height: '100%',
                placeItems: 'center',
                background:
                  'linear-gradient(135deg, rgba(21, 101, 192, 0.2), rgba(30, 41, 59, 0.9) 52%, rgba(15, 23, 42, 1))',
              }}
            >
              <Typography color="text.secondary">{emptyLabel}</Typography>
            </Box>
          )}

          <Box
            component="svg"
            viewBox={`0 0 ${contentSize.width} ${contentSize.height}`}
            preserveAspectRatio="none"
            sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {renderedStrokes}
            {renderedRemoteInProgressStrokes}
            {renderedMarkers}
            {renderedRemoteCursors}
          </Box>
        </Box>

        <AnimatePresence>
          {showLoading ? (
            <Box
              component={motion.div}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.05 : 0.2 }}
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 4,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
                background: displayedMapUrl
                  ? 'rgba(3, 7, 10, 0.58)'
                  : 'linear-gradient(145deg, #0c141a, #04080b)',
                backdropFilter: displayedMapUrl ? 'blur(3px)' : 'none',
              }}
            >
              <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={62} thickness={1.25} sx={{ color: 'primary.main' }} />
                <RadarOutlinedIcon
                  sx={{
                    position: 'absolute',
                    color: 'primary.light',
                    fontSize: 28,
                    filter: 'drop-shadow(0 0 10px rgba(215,185,119,.5))',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: 78,
                    width: 220,
                    textAlign: 'center',
                    color: 'rgba(237,241,243,.82)',
                    fontWeight: 600,
                  }}
                >
                  {loadingLabel}
                </Typography>
              </Box>
            </Box>
          ) : null}
        </AnimatePresence>
      </Box>
    </Box>
  )
}
