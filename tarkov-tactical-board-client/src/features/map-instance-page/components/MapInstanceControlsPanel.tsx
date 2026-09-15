import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import MapRoundedIcon from '@mui/icons-material/MapRounded'
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { MapInstanceControlsProps } from '../types'

interface Props extends MapInstanceControlsProps {
  dense?: boolean
  onClose?: () => void
}

export function MapInstanceControlsPanel(props: Props) {
  const { t, i18n } = useTranslation()
  const {
    instanceId,
    mapId,
    mapLabel,
    wsConnected,
    copied,
    mapPresets,
    selectedMapId,
    switchingMap,
    cursorScale,
    onCopyId,
    onSelectedMapIdChange,
    onSwitchMap,
    onCursorScaleChange,
    onBackHome,
    dense = false,
    onClose,
  } = props

  return (
    <Stack spacing={2.25} sx={{ minHeight: dense ? '100%' : 'auto' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1.5,
            color: 'primary.light',
            border: '1px solid rgba(215,185,119,.35)',
            backgroundColor: 'rgba(215,185,119,.08)',
          }}
        >
          <MapRoundedIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('mapInstance.mapSettings')}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {mapLabel}
          </Typography>
        </Box>
        {onClose ? (
          <Tooltip title={t('mapInstance.closeTools')}>
            <IconButton size="small" onClick={onClose}><CloseRoundedIcon fontSize="small" /></IconButton>
          </Tooltip>
        ) : null}
      </Stack>

      <Box
        sx={{
          px: 1.4,
          py: 1.15,
          borderRadius: 1.5,
          border: '1px solid rgba(144,166,182,.16)',
          backgroundColor: 'rgba(255,255,255,.025)',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('mapInstance.instanceId')}</Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }} noWrap>{instanceId}</Typography>
          </Box>
          <Tooltip title={copied ? t('mapInstance.copied') : t('mapInstance.copyInstanceId')}>
            <IconButton size="small" onClick={() => void onCopyId()}><ContentCopyRoundedIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center', mt: 1 }}>
          <Box className={`status-beacon ${wsConnected ? 'status-beacon--connected' : 'status-beacon--disconnected'}`} />
          <Typography sx={{ fontSize: 11.5, color: wsConnected ? '#67e8a2' : '#f58a8a' }}>
            {wsConnected ? t('mapInstance.realtimeConnected') : t('mapInstance.realtimeDisconnected')}
          </Typography>
        </Stack>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">{t('mapInstance.switchMap')}</Typography>
        <Stack spacing={1.1} sx={{ mt: 0.6 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="switch-map-label">{t('mapInstance.switchMap')}</InputLabel>
            <Select
              labelId="switch-map-label"
              label={t('mapInstance.switchMap')}
              value={selectedMapId ?? ''}
              disabled={mapPresets.length === 0 || switchingMap}
              onChange={(event) => {
                const value = Number(event.target.value)
                onSelectedMapIdChange(Number.isFinite(value) ? value : null)
              }}
              sx={{ backgroundColor: 'rgba(255,255,255,.025)' }}
            >
              {mapPresets.length === 0 ? <MenuItem value="">{t('mapInstance.switchMapEmpty')}</MenuItem> : null}
              {mapPresets.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {i18n.language.startsWith('zh') ? item.nameZh : item.nameEn}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            disabled={switchingMap || !selectedMapId || selectedMapId === mapId}
            onClick={onSwitchMap}
            sx={{ minHeight: 38 }}
          >
            {switchingMap ? t('common.loading') : t('mapInstance.switchMapApply')}
          </Button>
          {switchingMap ? <LinearProgress sx={{ height: 2, borderRadius: 1 }} /> : null}
        </Stack>
      </Box>

      <Divider />
      <Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">{t('mapInstance.collabCursorSize')}</Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{cursorScale.toFixed(1)}x</Typography>
        </Stack>
        <Slider value={cursorScale} min={1} max={2.6} step={0.1} onChange={(_, value) => onCursorScaleChange(Number(value))} />
      </Box>

      <Button color="inherit" variant="text" startIcon={<ArrowBackRoundedIcon />} onClick={onBackHome} sx={{ mt: 'auto', alignSelf: 'flex-start' }}>
        {t('mapInstance.backToMaps')}
      </Button>
    </Stack>
  )
}
