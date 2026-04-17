import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined'
import CenterFocusStrongOutlinedIcon from '@mui/icons-material/CenterFocusStrongOutlined'
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined'
import KeyboardBackspaceOutlinedIcon from '@mui/icons-material/KeyboardBackspaceOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import {
  Box,
  Button,
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

// Shared control surface for desktop sidebar and mobile drawer so both layouts stay behaviorally aligned.
export function MapInstanceControlsPanel(props: Props) {
  const { t, i18n } = useTranslation()
  const {
    mapId,
    mapPresets,
    selectedMapId,
    switchingMap,
    toolMode,
    brushColor,
    brushWidth,
    cursorScale,
    canUndo,
    onSelectedMapIdChange,
    onSwitchMap,
    onToolModeChange,
    onBrushColorChange,
    onBrushWidthChange,
    onCursorScaleChange,
    onResetView,
    onClearBoard,
    onUndo,
    onBackHome,
    dense = false,
    onClose,
  } = props
  const actionStackDirection = dense ? 'column' : 'row'

  return (
    <Stack spacing={dense ? 2 : 2.5}>
      <Stack direction={actionStackDirection} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
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
                  {i18n.language.startsWith('zh')
                    ? item.nameZh?.trim() || String(item.id)
                    : item.nameEn?.trim() || String(item.id)}
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
              max={56}
              step={1}
              onChange={(_, value) => onBrushWidthChange(Number(value))}
            />
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('mapInstance.collabCursorSize')}: {cursorScale.toFixed(1)}x
            </Typography>
            <Slider
              value={cursorScale}
              min={1}
              max={2.6}
              step={0.1}
              onChange={(_, value) => onCursorScaleChange(Number(value))}
            />
            <Typography variant="caption" color="text.secondary">
              {t('mapInstance.collabCursorSizeHint')}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  )
}
