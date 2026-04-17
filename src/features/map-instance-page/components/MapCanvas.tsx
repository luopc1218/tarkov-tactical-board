import { Box, Paper, Typography } from '@mui/material'
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

export function MapCanvas({
  containerRef,
  contentSize,
  viewport,
  toolMode,
  mapUrl,
  mapAlt,
  renderedStrokes,
  renderedRemoteInProgressStrokes,
  renderedRemoteCursors,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onImageLoad,
  emptyLabel,
}: MapCanvasProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        position: 'relative',
        display: 'flex',
        minHeight: { xs: '52vh', md: 0 },
        minWidth: 0,
        flex: 1,
        overflow: 'hidden',
        borderRadius: 4,
        borderColor: 'divider',
        background:
          'radial-gradient(circle at top left, rgba(25, 118, 210, 0.16), transparent 24%), linear-gradient(180deg, rgba(12, 17, 23, 0.98), rgba(9, 13, 18, 1))',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <Box
        ref={containerRef}
        onContextMenu={(event) => event.preventDefault()}
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
          {mapUrl ? (
            <Box
              component="img"
              src={mapUrl}
              alt={mapAlt}
              draggable={false}
              onDragStart={(event: React.DragEvent<HTMLImageElement>) => event.preventDefault()}
              onLoad={onImageLoad}
              sx={{
                pointerEvents: 'none',
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                userSelect: 'none',
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
            {renderedRemoteCursors}
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}
