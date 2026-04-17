import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined'
import CenterFocusStrongOutlinedIcon from '@mui/icons-material/CenterFocusStrongOutlined'
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import KeyboardBackspaceOutlinedIcon from '@mui/icons-material/KeyboardBackspaceOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { MapInstanceControlsProps } from '../types'

interface Props extends MapInstanceControlsProps {
  dense?: boolean
  onClose?: () => void
}

export function MapInstanceControlsPanel({
  instanceId,
  mapId,
  mapLabel,
  wsConnected,
  zoomPercent,
  copied,
  mapPresets,
  selectedMapId,
  switchingMap,
  toolMode,
  brushColor,
  brushWidth,
  cursorScale,
  canUndo,
  onCopyId,
  onSelectedMapIdChange,
  onSwitchMap,
  onToolModeChange,
  onBrushColorChange,
  onBrushWidthChange,
  onCursorScaleChange,
  onResetView,
  onOpenIntel,
  onClearBoard,
  onUndo,
  onBackHome,
  dense = false,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const actionStackDirection = dense ? 'column' : 'row'

  return (
    <Stack spacing={dense ? 2 : 2.5}>
      <Stack spacing={1.25}>
        <Typography variant="overline" color="text.secondary">
          {t('mapInstance.sessionInfo')}
        </Typography>
        <Stack
          direction={dense ? 'column' : 'row'}
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          <Chip
            icon={<LayersOutlinedIcon />}
            label={`${t('mapInstance.instanceId')}: ${instanceId}`}
            variant="outlined"
            sx={{ maxWidth: '100%' }}
          />
          <Chip
            label={
              wsConnected
                ? t('mapInstance.realtimeConnected')
                : t('mapInstance.realtimeDisconnected')
            }
            color={wsConnected ? 'success' : 'error'}
            variant="outlined"
          />
          <Chip label={`${t('mapInstance.zoom')}: ${zoomPercent}%`} variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('mapInstance.mapId')} {mapId ?? '-'} · {mapLabel}
        </Typography>
      </Stack>

      <Stack direction={actionStackDirection} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          color={copied ? 'success' : 'primary'}
          startIcon={<ContentCopyOutlinedIcon />}
          onClick={() => void onCopyId()}
        >
          {copied ? t('mapInstance.copied') : t('mapInstance.copyId')}
        </Button>
        <Button variant="outlined" startIcon={<InsightsOutlinedIcon />} onClick={onOpenIntel}>
          {t('mapInstance.mapIntelTitle')}
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<CenterFocusStrongOutlinedIcon />}
          onClick={onResetView}
        >
          {t('mapInstance.resetView')}
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<CleaningServicesOutlinedIcon />}
          onClick={onClearBoard}
        >
          {t('mapInstance.clearBoard')}
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<UndoOutlinedIcon />}
          disabled={!canUndo}
          onClick={onUndo}
        >
          {t('mapInstance.undoLastStroke')}
        </Button>
        <Button
          variant="text"
          color="inherit"
          startIcon={<KeyboardBackspaceOutlinedIcon />}
          onClick={onBackHome}
        >
          {t('mapInstance.backToMaps')}
        </Button>
        {onClose ? (
          <Button variant="text" color="inherit" onClick={onClose}>
            {t('mapInstance.closeTools')}
          </Button>
        ) : null}
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 3,
          backgroundColor: 'background.default',
        }}
      >
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel id="switch-map-label">{t('mapInstance.switchMap')}</InputLabel>
            <Select
              labelId="switch-map-label"
              label={t('mapInstance.switchMap')}
              value={selectedMapId ?? ''}
              disabled={mapPresets.length === 0 || switchingMap}
              onChange={(event) => {
                const nextValue = Number(event.target.value)
                onSelectedMapIdChange(Number.isFinite(nextValue) ? nextValue : null)
              }}
            >
              {mapPresets.length === 0 ? (
                <MenuItem value="">{t('mapInstance.switchMapEmpty')}</MenuItem>
              ) : null}
              {mapPresets.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.nameZh || item.nameEn}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            disabled={
              switchingMap || mapPresets.length === 0 || !selectedMapId || selectedMapId === mapId
            }
            onClick={onSwitchMap}
          >
            {switchingMap ? t('common.loading') : t('mapInstance.switchMapApply')}
          </Button>
        </Stack>
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 3,
          backgroundColor: 'background.default',
        }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle2">{t('mapInstance.tools')}</Typography>
          <ToggleButtonGroup
            exclusive
            color="primary"
            value={toolMode}
            onChange={(_, value) => {
              if (value) {
                onToolModeChange(value)
              }
            }}
            fullWidth
          >
            <ToggleButton value="draw">
              <BrushOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
              {t('mapInstance.drawTool')}
            </ToggleButton>
            <ToggleButton value="erase">
              <CleaningServicesOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
              {t('mapInstance.eraserTool')}
            </ToggleButton>
          </ToggleButtonGroup>

          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {t('mapInstance.brushColor')}
            </Typography>
            <TextField
              type="color"
              size="small"
              value={brushColor}
              onChange={(event) => onBrushColorChange(event.target.value)}
              slotProps={{ htmlInput: { 'aria-label': t('mapInstance.brushColor') } }}
              sx={{
                width: dense ? '100%' : 120,
                '& input': { p: 0.75, minHeight: 42 },
              }}
            />
          </Stack>

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('mapInstance.brushWidth')}: {brushWidth}
            </Typography>
            <Slider
              value={brushWidth}
              min={12}
              max={48}
              step={1}
              onChange={(_, value) => onBrushWidthChange(Number(value))}
            />
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('mapInstance.cursorSize')}: {cursorScale.toFixed(1)}x
            </Typography>
            <Slider
              value={cursorScale}
              min={1}
              max={2.6}
              step={0.1}
              onChange={(_, value) => onCursorScaleChange(Number(value))}
            />
          </Box>
        </Stack>
      </Paper>
    </Stack>
  )
}
