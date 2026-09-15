import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import BrushRoundedIcon from '@mui/icons-material/BrushRounded'
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded'
import CleaningServicesRoundedIcon from '@mui/icons-material/CleaningServicesRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import MapRoundedIcon from '@mui/icons-material/MapRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded'
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded'
import {
  Box,
  Button,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Paper,
  Popover,
  Slider,
  Stack,
  Tooltip,
  TextField,
  Typography,
} from '@mui/material'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MapCanvas } from '../features/map-instance-page/components/MapCanvas'
import { MapInstanceControlsPanel } from '../features/map-instance-page/components/MapInstanceControlsPanel'
import { useMapInstanceController } from '../features/map-instance-page/useMapInstanceController'
import { getMapAssetUrl } from '../constants/maps'

interface MapInstancePageProps {
  instanceId: string | null
  onBackHome: () => void
}

const surfaceSx = {
  border: '1px solid rgba(144, 166, 182, 0.24)',
  background: 'linear-gradient(180deg, rgba(14, 23, 30, 0.96), rgba(7, 13, 18, 0.96))',
  boxShadow: '0 18px 50px rgba(0, 0, 0, 0.32)',
  backdropFilter: 'blur(18px)',
}

const BRUSH_COLORS = ['#f0c66a', '#42dc93', '#58b7ff', '#ff5f63', '#d977f0', '#f4f7f8']

export function MapInstancePage({ instanceId, onBackHome }: MapInstancePageProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [brushSettingsAnchor, setBrushSettingsAnchor] = useState<HTMLElement | null>(null)
  const [markerLabel, setMarkerLabel] = useState('')
  const [markerCreateColor, setMarkerCreateColor] = useState(BRUSH_COLORS[0])
  const [markerCreateFontSize, setMarkerCreateFontSize] = useState(48)
  const [markerCreateSize, setMarkerCreateSize] = useState(48)
  const [markerEditLabel, setMarkerEditLabel] = useState('')
  const [markerEditColor, setMarkerEditColor] = useState(BRUSH_COLORS[0])
  const [markerEditFontSize, setMarkerEditFontSize] = useState(48)
  const [markerEditSize, setMarkerEditSize] = useState(48)
  const controller = useMapInstanceController(instanceId)

  const controlsProps = useMemo(
    () => ({
      instanceId: controller.currentInstanceId,
      mapId: controller.currentMapId,
      mapLabel: controller.resolvedMapLabel,
      wsConnected: controller.wsConnected,
      zoomPercent: Math.round(controller.viewport.scale * 100),
      copied: controller.copied,
      mapPresets: controller.mapPresets,
      selectedMapId: controller.selectedMapId,
      switchingMap: controller.switchingMap,
      toolMode: controller.toolMode,
      brushColor: controller.brushColor,
      brushWidth: controller.brushWidth,
      cursorScale: controller.cursorScale,
      canUndo: controller.canUndo,
      onCopyId: controller.copyInstanceId,
      onSelectedMapIdChange: controller.setSelectedMapId,
      onSwitchMap: controller.handleSwitchMap,
      onToolModeChange: controller.setToolMode,
      onBrushColorChange: controller.setBrushColor,
      onBrushWidthChange: controller.setBrushWidth,
      onCursorScaleChange: controller.setCursorScale,
      onResetView: () =>
        controller.fitViewportToContent(controller.contentSize.width, controller.contentSize.height),
      onClearBoard: controller.clearBoard,
      onUndo: controller.undoLastAction,
      onBackHome,
    }),
    [controller, onBackHome],
  )

  useEffect(() => {
    if (!controller.currentMapId) return
    const currentIndex = controller.mapPresets.findIndex((item) => item.id === controller.currentMapId)
    const candidates = [controller.mapPresets[currentIndex - 1], controller.mapPresets[currentIndex + 1]].filter(Boolean)
    const preload = () => {
      candidates.forEach((preset) => {
        const image = new Image()
        image.decoding = 'async'
        image.src = getMapAssetUrl(preset.mapFileName)
      })
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preload, { timeout: 1800 })
      return () => idleWindow.cancelIdleCallback?.(handle)
    }
    const handle = window.setTimeout(preload, 700)
    return () => window.clearTimeout(handle)
  }, [controller.currentMapId, controller.mapPresets])

  useEffect(() => {
    if (controller.toolMode !== 'draw') queueMicrotask(() => setBrushSettingsAnchor(null))
  }, [controller.toolMode])

  useEffect(() => {
    if (!controller.pendingMarkerPoint) return
    queueMicrotask(() => {
      setMarkerLabel('')
      setMarkerCreateColor(controller.brushColor)
      setMarkerCreateFontSize(48)
      setMarkerCreateSize(48)
    })
  }, [controller.brushColor, controller.pendingMarkerPoint])

  useEffect(() => {
    const marker = controller.markerSettingsRequest?.marker
    if (!marker) return
    queueMicrotask(() => {
      setMarkerEditLabel(marker.label)
      setMarkerEditColor(marker.color)
      setMarkerEditFontSize(marker.fontSize)
      setMarkerEditSize(marker.markerSize)
    })
  }, [controller.markerSettingsRequest])

  const openBrushSettings = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    controller.setToolMode('draw')
    setBrushSettingsAnchor(event.currentTarget)
  }

  const submitMarker = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!markerLabel.trim()) return
    controller.addMarker({
      label: markerLabel,
      color: markerCreateColor,
      fontSize: markerCreateFontSize,
      markerSize: markerCreateSize,
    })
  }

  const submitMarkerSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const marker = controller.markerSettingsRequest?.marker
    if (!marker || !markerEditLabel.trim()) return
    controller.updateMarker({
      id: marker.id,
      label: markerEditLabel,
      color: markerEditColor,
      fontSize: markerEditFontSize,
      markerSize: markerEditSize,
    })
  }

  if (!instanceId || (!controller.loading && !controller.instance)) {
    return (
      <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 520, p: 4, ...surfaceSx }}>
          <Typography variant="h4">{t('mapInstance.notFoundTitle')}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5 }}>
            {t('mapInstance.notFoundDesc')}
          </Typography>
          <Button variant="contained" startIcon={<ArrowBackRoundedIcon />} sx={{ mt: 3 }} onClick={onBackHome}>
            {t('common.backHome')}
          </Button>
        </Paper>
      </Box>
    )
  }

  const toolButtonSx = {
    width: 44,
    height: 44,
    borderRadius: 1.5,
    color: 'rgba(208, 220, 229, 0.76)',
    '&:hover': { color: '#fff', backgroundColor: 'rgba(255,255,255,.08)' },
  }
  const activeToolSx = {
    ...toolButtonSx,
    color: 'primary.light',
    border: '1px solid rgba(215,185,119,.72)',
    backgroundColor: 'rgba(215,185,119,.13)',
    boxShadow: 'inset 0 0 18px rgba(215,185,119,.08), 0 0 20px rgba(215,185,119,.16)',
  }

  return (
    <Box component="main" onContextMenu={(event) => event.preventDefault()} sx={{ height: '100svh', minHeight: 0, overflow: 'hidden', bgcolor: '#03070a' }}>
      <Box
        component={motion.header}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.08 : 0.34 }}
        sx={{
          height: 'calc(52px + var(--desktop-titlebar-safe-top))',
          pt: 'var(--desktop-titlebar-safe-top)',
          px: { xs: 1, md: 2 },
          pr: 'calc(16px + var(--desktop-titlebar-safe-right))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: { xs: 0.5, md: 2 },
          borderBottom: '1px solid rgba(144,166,182,.18)',
          background: 'rgba(6, 12, 17, .94)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 20,
        }}
      >
        <Stack direction="row" spacing={1.1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Tooltip title={t('mapInstance.backToMaps')}>
            <IconButton size="small" onClick={onBackHome} sx={{ color: 'text.secondary' }}>
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <MapRoundedIcon sx={{ color: 'primary.main', fontSize: 23 }} />
          <Box sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }} noWrap>
              Tarkov Tactical Board
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.2 }} noWrap>
              Plan. Share. Survive.
            </Typography>
          </Box>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            position: { xs: 'static', md: 'absolute' },
            left: '50%',
            transform: { xs: 'none', md: 'translateX(-50%)' },
            px: { xs: 1, md: 1.4 },
            py: 0.45,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.8, md: 1.2 },
            minWidth: 0,
            flex: { xs: 1, md: 'none' },
            overflow: 'hidden',
            ...surfaceSx,
          }}
        >
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 12, color: 'text.secondary' }}>
            {t('mapInstance.instanceId')}
          </Typography>
          <Typography noWrap sx={{ minWidth: 0, maxWidth: { xs: 142, sm: 260 }, fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#e7edf1', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {controller.currentInstanceId}
          </Typography>
          <Tooltip title={controller.copied ? t('mapInstance.copied') : t('mapInstance.copyInstanceId')}>
            <IconButton size="small" onClick={() => void controller.copyInstanceId()} sx={{ p: 0.45 }}>
              <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25, display: { xs: 'none', sm: 'block' } }} />
          <Box className={`status-beacon ${controller.wsConnected ? 'status-beacon--connected' : 'status-beacon--disconnected'}`} />
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 12, color: controller.wsConnected ? '#67e8a2' : '#f58a8a' }}>
            {controller.wsConnected ? t('mapInstance.realtimeConnected') : t('mapInstance.realtimeDisconnected')}
          </Typography>
        </Paper>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 12, color: 'text.secondary' }} noWrap>
            {controller.resolvedMapLabel}
          </Typography>
          <Tooltip title={t('mapInstance.tools')}>
            <IconButton size="small" onClick={() => setMobileDrawerOpen(true)} sx={{ display: { md: 'none' } }}>
              <MenuRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Box sx={{ height: 'calc(100svh - 52px - var(--desktop-titlebar-safe-top))', display: 'flex', minHeight: 0 }}>
        <Box sx={{ position: 'relative', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <MapCanvas
            containerRef={controller.containerRef}
            contentSize={controller.contentSize}
            viewport={controller.viewport}
            toolMode={controller.toolMode}
            mapUrl={controller.mapUrl}
            switchingMap={controller.switchingMap}
            mapAlt={controller.resolvedMapLabel}
            renderedStrokes={controller.renderedStrokes}
            renderedRemoteInProgressStrokes={controller.renderedRemoteInProgressStrokes}
            renderedRemoteCursors={controller.renderedRemoteCursors}
            renderedMarkers={controller.renderedMarkers}
            onPointerDown={controller.onPointerDown}
            onPointerMove={controller.onPointerMove}
            onPointerUp={controller.onPointerUp}
            onPointerLeave={controller.onPointerLeave}
            onContextMenu={controller.onContextMenu}
            onImageLoad={controller.handleImageLoad}
            emptyLabel={t('mapInstance.noMapBackground')}
            loadingLabel={t('mapInstance.mapImageLoading')}
          />

          <Paper
            component={motion.div}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.18, duration: 0.28 }}
            sx={{
              position: 'absolute',
              left: { xs: 10, md: 16 },
              top: '50%',
              transform: 'translateY(-50%) !important',
              zIndex: 8,
              p: 0.65,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.6,
              borderRadius: 2,
              ...surfaceSx,
            }}
          >
            <Tooltip title={t('mapInstance.drawTool')} placement="right">
              <IconButton
                sx={controller.toolMode === 'draw' ? activeToolSx : toolButtonSx}
                onClick={() => controller.setToolMode('draw')}
                onContextMenu={openBrushSettings}
              >
                <BrushRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('mapInstance.eraserTool')} placement="right">
              <IconButton sx={controller.toolMode === 'erase' ? activeToolSx : toolButtonSx} onClick={() => controller.setToolMode('erase')}>
                <CleaningServicesRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('mapInstance.markerTool')} placement="right">
              <IconButton sx={controller.toolMode === 'marker' ? activeToolSx : toolButtonSx} onClick={() => controller.setToolMode('marker')}>
                <PlaceRoundedIcon />
              </IconButton>
            </Tooltip>
          </Paper>

          <Paper
            component={motion.div}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.22, duration: 0.3 }}
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: { xs: 12, md: 16 },
              transform: 'translateX(-50%) !important',
              zIndex: 8,
              px: 0.7,
              py: 0.6,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 0.3,
              maxWidth: 'calc(100% - 24px)',
              ...surfaceSx,
            }}
          >
            <Tooltip title={t('mapInstance.undoLastStroke')}>
              <span><IconButton size="small" disabled={!controller.canUndo} onClick={controller.undoLastAction}><UndoRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title={t('mapInstance.resetView')}>
              <IconButton size="small" onClick={() => controller.fitViewportToContent(controller.contentSize.width, controller.contentSize.height)}><CenterFocusStrongRoundedIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title={t('mapInstance.clearBoard')}>
              <IconButton size="small" color="error" onClick={controller.clearBoard}><DeleteSweepRoundedIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <IconButton size="small" onClick={controller.zoomOut} aria-label="zoom out"><ZoomOutRoundedIcon fontSize="small" /></IconButton>
            <Typography sx={{ width: 54, textAlign: 'center', fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
              {Math.round(controller.viewport.scale * 100)}%
            </Typography>
            <IconButton size="small" onClick={controller.zoomIn} aria-label="zoom in"><ZoomInRoundedIcon fontSize="small" /></IconButton>
          </Paper>
        </Box>

        <Box
          component={motion.aside}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.08 : 0.34, delay: prefersReducedMotion ? 0 : 0.08 }}
          sx={{
            display: { xs: 'none', md: 'block' },
            width: { md: 330, lg: 360 },
            flexShrink: 0,
            overflowY: 'auto',
            borderLeft: '1px solid rgba(144,166,182,.2)',
            background: 'linear-gradient(180deg, #0b1319, #070d12)',
            p: 2,
          }}
        >
          <MapInstanceControlsPanel {...controlsProps} />
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '92%', sm: 400 }, p: 2, background: '#081016' } } }}
      >
        <MapInstanceControlsPanel {...controlsProps} dense onClose={() => setMobileDrawerOpen(false)} />
      </Drawer>

      <Popover
        open={Boolean(brushSettingsAnchor) && controller.toolMode === 'draw'}
        anchorEl={brushSettingsAnchor}
        onClose={() => setBrushSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        slotProps={{ paper: { sx: { ml: 1.2, width: 250, p: 2, ...surfaceSx } } }}
      >
        <Typography variant="subtitle2">{t('mapInstance.brushSettings')}</Typography>
        <Typography variant="caption" color="text.secondary">{t('mapInstance.brushSettingsHint')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{t('mapInstance.brushColor')}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {BRUSH_COLORS.map((color) => (
            <Box
              component="button"
              type="button"
              key={color}
              aria-label={`${t('mapInstance.brushColor')} ${color}`}
              onClick={() => controller.setBrushColor(color)}
              sx={{
                width: 26,
                height: 26,
                p: 0,
                borderRadius: '50%',
                bgcolor: color,
                border: color.toLowerCase() === controller.brushColor.toLowerCase() ? '2px solid #fff' : '2px solid rgba(255,255,255,.15)',
                boxShadow: color.toLowerCase() === controller.brushColor.toLowerCase() ? `0 0 0 3px ${color}33` : 'none',
              }}
            />
          ))}
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 2.25 }}>
          <Typography variant="body2" color="text.secondary">{t('mapInstance.brushWidth')}</Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{controller.brushWidth}px</Typography>
        </Stack>
        <Slider value={controller.brushWidth} min={12} max={56} step={1} onChange={(_, value) => controller.setBrushWidth(Number(value))} />
      </Popover>

      <Popover
        open={Boolean(controller.markerSettingsRequest)}
        onClose={controller.closeMarkerSettings}
        anchorReference="anchorPosition"
        anchorPosition={controller.markerSettingsRequest
          ? { top: controller.markerSettingsRequest.clientY, left: controller.markerSettingsRequest.clientX }
          : undefined}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { ml: 1, width: 280, p: 2, ...surfaceSx } } }}
      >
        <Box component="form" onSubmit={submitMarkerSettings}>
          <Typography variant="subtitle2">{t('mapInstance.markerSettings')}</Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            multiline
            minRows={2}
            maxRows={5}
            value={markerEditLabel}
            onChange={(event) => setMarkerEditLabel(event.target.value)}
            label={t('mapInstance.markerLabel')}
            slotProps={{ htmlInput: { maxLength: 160 } }}
            sx={{ mt: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{t('mapInstance.markerColor')}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {BRUSH_COLORS.map((color) => (
              <Box
                component="button"
                type="button"
                key={color}
                aria-label={`${t('mapInstance.markerColor')} ${color}`}
                onClick={() => setMarkerEditColor(color)}
                sx={{
                  width: 26,
                  height: 26,
                  p: 0,
                  borderRadius: '50%',
                  bgcolor: color,
                  border: color.toLowerCase() === markerEditColor.toLowerCase() ? '2px solid #fff' : '2px solid rgba(255,255,255,.15)',
                  boxShadow: color.toLowerCase() === markerEditColor.toLowerCase() ? `0 0 0 3px ${color}33` : 'none',
                }}
              />
            ))}
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 2.25 }}>
            <Typography variant="body2" color="text.secondary">{t('mapInstance.markerFontSize')}</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{markerEditFontSize}px</Typography>
          </Stack>
          <Slider value={markerEditFontSize} min={16} max={96} step={2} onChange={(_, value) => setMarkerEditFontSize(Number(value))} />
          <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">{t('mapInstance.markerSize')}</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{markerEditSize}px</Typography>
          </Stack>
          <Slider value={markerEditSize} min={16} max={96} step={2} onChange={(_, value) => setMarkerEditSize(Number(value))} />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', mt: 1 }}>
            <Button
              color="error"
              startIcon={<DeleteRoundedIcon />}
              onClick={() => {
                const markerId = controller.markerSettingsRequest?.marker.id
                if (markerId) controller.deleteMarker(markerId)
              }}
            >
              {t('mapInstance.deleteMarker')}
            </Button>
            <Button type="submit" variant="contained" disabled={!markerEditLabel.trim()}>{t('mapInstance.saveMarker')}</Button>
          </Stack>
        </Box>
      </Popover>

      <Dialog open={Boolean(controller.pendingMarkerPoint)} onClose={controller.cancelMarker} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={submitMarker}>
          <DialogTitle>{t('mapInstance.addMarkerTitle')}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
              value={markerLabel}
              onChange={(event) => setMarkerLabel(event.target.value)}
              label={t('mapInstance.markerLabel')}
              placeholder={t('mapInstance.markerLabelPlaceholder')}
              slotProps={{ htmlInput: { maxLength: 160 } }}
              sx={{ mt: 1 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2.25 }}>
              {t('mapInstance.markerColor')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {BRUSH_COLORS.map((color) => (
                <Box
                  component="button"
                  type="button"
                  key={color}
                  aria-label={`${t('mapInstance.markerColor')} ${color}`}
                  onClick={() => setMarkerCreateColor(color)}
                  sx={{
                    width: 28,
                    height: 28,
                    p: 0,
                    borderRadius: '50%',
                    bgcolor: color,
                    border: color.toLowerCase() === markerCreateColor.toLowerCase() ? '2px solid #fff' : '2px solid rgba(255,255,255,.15)',
                    boxShadow: color.toLowerCase() === markerCreateColor.toLowerCase() ? `0 0 0 3px ${color}33` : 'none',
                  }}
                />
              ))}
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 2.25 }}>
              <Typography variant="body2" color="text.secondary">{t('mapInstance.markerFontSize')}</Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{markerCreateFontSize}px</Typography>
            </Stack>
            <Slider
              value={markerCreateFontSize}
              min={16}
              max={96}
              step={2}
              onChange={(_, value) => setMarkerCreateFontSize(Number(value))}
            />
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1.5 }}>
              <Typography variant="body2" color="text.secondary">{t('mapInstance.markerSize')}</Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{markerCreateSize}px</Typography>
            </Stack>
            <Slider
              value={markerCreateSize}
              min={16}
              max={96}
              step={2}
              onChange={(_, value) => setMarkerCreateSize(Number(value))}
            />
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={controller.cancelMarker}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" disabled={!markerLabel.trim()}>{t('mapInstance.addMarker')}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
