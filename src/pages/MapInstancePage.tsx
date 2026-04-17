import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined'
import {
  Alert,
  Box,
  Button,
  Drawer,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
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

export function MapInstancePage({ instanceId, onBackHome }: MapInstancePageProps) {
  const { t } = useTranslation()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [intelDrawerOpen, setIntelDrawerOpen] = useState(false)

  const controller = useMapInstanceController(instanceId)

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
      controller.fitViewportToContent(
        controller.contentSize.width,
        controller.contentSize.height,
      ),
    onOpenIntel: () => {
      controller.setMapIntelPanelOpen(true)
      setIntelDrawerOpen(true)
    },
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
        pt: { xs: 'calc(56px + var(--desktop-titlebar-safe-top))', md: 'calc(24px + var(--desktop-titlebar-safe-top))' },
        pb: { xs: 1.5, md: 2.5 },
      }}
    >
      <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 1.5,
            py: 1,
            borderRadius: 3,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {t('mapInstance.instanceId')}
            </Typography>
            <Typography variant="body2" noWrap>
              {controller.currentInstanceId}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MenuOutlinedIcon />}
            onClick={() => setMobileDrawerOpen(true)}
          >
            {t('mapInstance.tools')}
          </Button>
        </Paper>

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
          mapIntelLoadError={controller.mapIntelLoadError}
          mapIntelPanelOpen={controller.mapIntelPanelOpen}
          bossIntelOpen={controller.bossIntelOpen}
          extractionsOpen={controller.extractionsOpen}
          highValueLootOpen={controller.highValueLootOpen}
          setMapIntelPanelOpen={controller.setMapIntelPanelOpen}
          setBossIntelOpen={controller.setBossIntelOpen}
          setExtractionsOpen={controller.setExtractionsOpen}
          setHighValueLootOpen={controller.setHighValueLootOpen}
          renderIntelBool={controller.renderIntelBool}
          isGuaranteedSpawnChance={controller.isGuaranteedSpawnChance}
          getIntelTagColor={controller.getIntelTagColor}
          renderExtractionCard={controller.renderExtractionCard}
          renderLootCard={controller.renderLootCard}
          onClose={() => setIntelDrawerOpen(false)}
        />
      </Drawer>
    </Box>
  )
}
