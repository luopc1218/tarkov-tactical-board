import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined'
import { Alert, Box, Button, Chip, Drawer, Grid, Paper, Stack, Typography } from '@mui/material'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { MapCanvas } from '../features/map-instance-page/components/MapCanvas'
import { MapInstanceControlsPanel } from '../features/map-instance-page/components/MapInstanceControlsPanel'
import { MapIntelPanel } from '../features/map-instance-page/components/MapIntelPanel'
import { useMapInstanceController } from '../features/map-instance-page/useMapInstanceController'

interface MapInstancePageProps {
  instanceId: string | null
  onBackHome: () => void
}

// The page keeps layout concerns here and delegates whiteboard state orchestration to the controller hook.
export function MapInstancePage({ instanceId, onBackHome }: MapInstancePageProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [intelDrawerOpen, setIntelDrawerOpen] = useState(false)

  const controller = useMapInstanceController(instanceId)
  const realtimeConnected = controller.wsConnected

  if (!instanceId || (!controller.loading && !controller.instance)) {
    return (
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          px: 2,
          py: 6,
        }}
      >
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 560, p: { xs: 3, md: 4 } }}>
          <Typography variant="h4">{t('mapInstance.notFoundTitle')}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5 }}>
            {t('mapInstance.notFoundDesc')}
          </Typography>
          <Button variant="contained" sx={{ mt: 3 }} onClick={onBackHome}>
            {t('common.backHome')}
          </Button>
        </Paper>
      </Box>
    )
  }

  const controlsProps = {
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
    onUndo: controller.undoLastStroke,
    onBackHome,
  }

  return (
    <Box
      component="main"
      sx={{
        boxSizing: 'border-box',
        height: '100vh',
        minHeight: '100vh',
        overflow: 'hidden',
        px: { xs: 1.5, md: 2.5 },
        pt: {
          xs: 'calc(56px + var(--desktop-titlebar-safe-top))',
          md: 'calc(24px + var(--desktop-titlebar-safe-top))',
        },
        pb: { xs: 1.5, md: 2.5 },
      }}
    >
      <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0 }}>
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <Paper
            className="lift-on-hover"
            variant="outlined"
            sx={{
              px: { xs: 1.5, md: 2 },
              py: { xs: 1.25, md: 1.5 },
              borderRadius: 2,
              backgroundImage:
                'linear-gradient(135deg, rgba(25, 118, 210, 0.08), rgba(15, 23, 42, 0.02) 42%, rgba(22, 163, 74, 0.08) 100%)',
              position: 'relative',
              overflow: 'hidden',
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: realtimeConnected
                  ? 'linear-gradient(120deg, transparent 0%, rgba(74, 222, 128, 0.08) 38%, transparent 72%)'
                  : 'linear-gradient(120deg, transparent 0%, rgba(248, 113, 113, 0.09) 38%, transparent 72%)',
                opacity: prefersReducedMotion ? 0.42 : 0.9,
                transform: prefersReducedMotion ? 'none' : 'translateX(-42%)',
                animation: prefersReducedMotion
                  ? 'none'
                  : 'map-instance-status-sheen 2.9s ease-in-out infinite',
                pointerEvents: 'none',
              },
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 1.25, md: 1.5 }}
              sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}
            >
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary">
                  {t('mapInstance.sessionInfo')}
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  useFlexGap
                  sx={{ alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ minWidth: 0, alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Typography variant="h6" sx={{ fontSize: { xs: '1rem', md: '1.1rem' } }}>
                      {t('mapInstance.instanceId')}
                    </Typography>
                    <Chip
                      label={controller.currentInstanceId}
                      color="primary"
                      variant="outlined"
                      sx={{ maxWidth: '100%', '& .MuiChip-label': { fontFamily: 'monospace' } }}
                    />
                    <Button
                      variant={controller.copied ? 'contained' : 'outlined'}
                      color={controller.copied ? 'success' : 'primary'}
                      size="small"
                      startIcon={<ContentCopyOutlinedIcon />}
                      onClick={() => void controller.copyInstanceId()}
                    >
                      {controller.copied
                        ? t('mapInstance.copied')
                        : t('mapInstance.copyInstanceId')}
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label={`${t('mapInstance.mapId')}: ${controller.currentMapId ?? '-'}`}
                      variant="outlined"
                    />
                    <Chip size="small" label={controller.resolvedMapLabel} variant="outlined" />
                    <motion.div
                      key={realtimeConnected ? 'realtime-connected' : 'realtime-disconnected'}
                      initial={
                        prefersReducedMotion
                          ? { opacity: 0.92 }
                          : { opacity: 0, scale: 0.94, y: 6, filter: 'blur(4px)' }
                      }
                      animate={
                        prefersReducedMotion
                          ? { opacity: 1 }
                          : {
                              opacity: 1,
                              scale: [1, 1.035, 1],
                              y: 0,
                              filter: 'blur(0px)',
                            }
                      }
                      transition={{
                        duration: prefersReducedMotion ? 0.14 : 0.44,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      style={{ display: 'inline-flex' }}
                      className="animate__animated animate__fadeIn animate-fast"
                    >
                      <Chip
                        size="small"
                        color={realtimeConnected ? 'success' : 'error'}
                        label={
                          <Stack direction="row" spacing={0.9} sx={{ alignItems: 'center' }}>
                            <Box
                              component="span"
                              className={`status-beacon ${
                                realtimeConnected
                                  ? 'status-beacon--connected'
                                  : 'status-beacon--disconnected'
                              }`}
                            />
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={realtimeConnected ? 'connected-text' : 'disconnected-text'}
                                initial={
                                  prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }
                                }
                                animate={
                                  prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                                }
                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                style={{ display: 'inline-block' }}
                              >
                                {realtimeConnected
                                  ? t('mapInstance.realtimeConnected')
                                  : t('mapInstance.realtimeDisconnected')}
                              </motion.span>
                            </AnimatePresence>
                          </Stack>
                        }
                        variant="outlined"
                        sx={{
                          borderWidth: 1.5,
                          fontWeight: 700,
                          backdropFilter: 'blur(10px)',
                          boxShadow: realtimeConnected
                            ? '0 0 0 1px rgba(74, 222, 128, 0.12), 0 0 24px rgba(74, 222, 128, 0.18)'
                            : '0 0 0 1px rgba(248, 113, 113, 0.12), 0 0 24px rgba(248, 113, 113, 0.16)',
                          '& .MuiChip-label': {
                            px: 1.2,
                            py: 0.15,
                          },
                        }}
                      />
                    </motion.div>
                  </Stack>
                </Stack>
              </Stack>

              <Stack
                direction={{ xs: 'row', md: 'row' }}
                spacing={1}
                sx={{
                  alignItems: 'center',
                  justifyContent: { xs: 'space-between', md: 'flex-end' },
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<InsightsOutlinedIcon />}
                  onClick={() => {
                    setIntelDrawerOpen(true)
                    void controller.loadMapIntel()
                  }}
                >
                  {t('mapInstance.mapIntelTitle')}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<MenuOutlinedIcon />}
                  onClick={() => setMobileDrawerOpen(true)}
                  sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                >
                  {t('mapInstance.tools')}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </motion.div>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            px: 0.5,
            display: 'block',
          }}
        >
          {t('mapInstance.panHint')}
        </Typography>

        {controller.loading ? (
          <Alert severity="info">{t('common.loading')}</Alert>
        ) : (
          <Grid
            container
            spacing={1.5}
            sx={{
              flex: 1,
              minHeight: 0,
              height: '100%',
              alignItems: 'stretch',
            }}
          >
            <Grid
              size={{ xs: 12, md: 8.5 }}
              sx={{
                display: 'flex',
                minHeight: 0,
                height: {
                  xs: '100%',
                  md: '100%',
                },
              }}
            >
              <MapCanvas
                containerRef={controller.containerRef}
                contentSize={controller.contentSize}
                viewport={controller.viewport}
                toolMode={controller.toolMode}
                mapUrl={controller.mapUrl}
                mapAlt={
                  controller.currentMapId
                    ? `${t('mapInstance.mapId')} ${controller.currentMapId}`
                    : 'map'
                }
                renderedStrokes={controller.renderedStrokes}
                renderedRemoteInProgressStrokes={controller.renderedRemoteInProgressStrokes}
                renderedRemoteCursors={controller.renderedRemoteCursors}
                onPointerDown={controller.onPointerDown}
                onPointerMove={controller.onPointerMove}
                onPointerUp={controller.onPointerUp}
                onPointerLeave={controller.onPointerLeave}
                onImageLoad={controller.handleImageLoad}
                emptyLabel={t('mapInstance.noMapBackground')}
              />
            </Grid>

            <Grid
              size={{ xs: 0, md: 3.5 }}
              sx={{
                display: { xs: 'none', md: 'flex' },
                minHeight: 0,
                height: '100%',
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  pr: 0.5,
                }}
              >
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <MapInstanceControlsPanel {...controlsProps} />
                </Paper>
              </Box>
            </Grid>
          </Grid>
        )}
      </Stack>

      <Drawer
        anchor="right"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 440 },
              p: 2,
              backgroundImage: 'none',
            },
          },
        }}
      >
        <MapInstanceControlsPanel
          {...controlsProps}
          dense
          onClose={() => setMobileDrawerOpen(false)}
        />
      </Drawer>

      <Drawer
        anchor="right"
        open={intelDrawerOpen}
        onClose={() => setIntelDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 520 },
              p: { xs: 1, sm: 1.5 },
              backgroundColor: 'background.default',
            },
          },
        }}
      >
        <MapIntelPanel
          mapIntel={controller.mapIntel}
          mapIntelLoading={controller.mapIntelLoading}
          mapIntelLoadError={controller.mapIntelLoadError}
          bossIntelOpen={controller.bossIntelOpen}
          extractionsOpen={controller.extractionsOpen}
          setBossIntelOpen={controller.setBossIntelOpen}
          setExtractionsOpen={controller.setExtractionsOpen}
          renderIntelBool={controller.renderIntelBool}
          isGuaranteedSpawnChance={controller.isGuaranteedSpawnChance}
          getIntelTagColor={controller.getIntelTagColor}
          renderExtractionCard={controller.renderExtractionCard}
          onClose={() => setIntelDrawerOpen(false)}
        />
      </Drawer>
    </Box>
  )
}
