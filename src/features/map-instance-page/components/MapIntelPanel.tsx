import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MapIntelPanelProps } from '../types'

export function MapIntelPanel({
  mapIntel,
  mapIntelLoading,
  mapIntelLoadError,
  bossIntelOpen,
  extractionsOpen,
  setBossIntelOpen,
  setExtractionsOpen,
  isGuaranteedSpawnChance,
  renderExtractionCard,
  onClose,
}: MapIntelPanelProps) {
  const { t, i18n } = useTranslation()
  const [searchKeyword, setSearchKeyword] = useState('')

  const handleSearchSubmit = () => {
    const keyword = searchKeyword.trim()
    if (!keyword) {
      return
    }
    const encodedKeyword = encodeURIComponent(keyword)
    window.open(
      `https://www.eftarkov.com/news/?list_refer-theme-${encodedKeyword}.html`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const resolvedMapName = i18n.language.startsWith('zh')
    ? mapIntel?.mapNameZh?.trim() || ''
    : mapIntel?.mapNameEn?.trim() || ''

  return (
    <Box
      sx={{
        display: 'flex',
        height: 'auto',
        minHeight: 'fit-content',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 2.5,
        border: 1,
        borderColor: 'divider',
        background:
          'linear-gradient(180deg, rgba(18, 24, 32, 0.98), rgba(11, 16, 22, 0.98) 100%)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
      }}
    >
      <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="primary.light">
              {t('mapInstance.tacticalIntelLabel')}
            </Typography>
            <Typography variant="h6">{t('mapInstance.mapIntelTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('mapInstance.mapIntelSummary')}
            </Typography>
            {resolvedMapName && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {resolvedMapName}
              </Typography>
            )}
            <TextField
              size="small"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSearchSubmit()
                }
              }}
              placeholder={t('mapInstance.mapIntelSearchPlaceholder')}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                mt: 1.5,
                maxWidth: 360,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(15, 23, 42, 0.3)',
                },
              }}
            />
          </Box>
          {onClose ? (
            <Button variant="text" size="small" color="inherit" onClick={onClose}>
              {t('mapInstance.closeTools')}
            </Button>
          ) : null}
        </Stack>
      </Box>

      <Box sx={{ p: 2 }}>
        <Stack spacing={2}>
          {mapIntelLoading ? <Alert severity="info">{t('common.loading')}</Alert> : null}
          {mapIntelLoadError ? <Alert severity="error">{mapIntelLoadError}</Alert> : null}
          {mapIntel?.errorMessage ? <Alert severity="warning">{mapIntel.errorMessage}</Alert> : null}

          <Accordion expanded={bossIntelOpen} onChange={(_, expanded) => setBossIntelOpen(expanded)} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="subtitle2">{t('mapInstance.bossRefreshTitle')}</Typography>
                  <Chip
                    size="small"
                    label={(mapIntel?.bossRefresh.regular.length ?? 0) + (mapIntel?.bossRefresh.pve.length ?? 0)}
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {[
                    {
                      key: 'regular',
                      title: t('mapInstance.bossRefreshRegularShort'),
                      items: mapIntel?.bossRefresh.regular ?? [],
                    },
                    {
                      key: 'pve',
                      title: t('mapInstance.bossRefreshPve'),
                      items: mapIntel?.bossRefresh.pve ?? [],
                    },
                  ].map((group) => (
                    <Card key={group.key} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">{group.title}</Typography>
                        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                          {group.items.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              {t('mapInstance.noData')}
                            </Typography>
                          ) : (
                            group.items.map((item) => (
                              <Stack
                                key={item.id}
                                direction="row"
                                spacing={1.5}
                                sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                                    {item.name}
                                  </Typography>
                                  {item.nameSecondary ? (
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      {item.nameSecondary}
                                    </Typography>
                                  ) : null}
                                </Box>
                                <Chip
                                  label={item.chanceText}
                                  color={isGuaranteedSpawnChance(item.chanceText) ? 'error' : 'warning'}
                                />
                              </Stack>
                            ))
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </AccordionDetails>
          </Accordion>

          <Accordion expanded={extractionsOpen} onChange={(_, expanded) => setExtractionsOpen(expanded)} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="subtitle2">{t('mapInstance.extractionsTitle')}</Typography>
                  <Chip size="small" label={mapIntel?.extractions.length ?? 0} variant="outlined" />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {mapIntel?.extractions.length ? (
                    mapIntel.extractions.map(renderExtractionCard)
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('mapInstance.extractionsEmpty')}
                    </Typography>
                  )}
                </Stack>
              </AccordionDetails>
          </Accordion>
        </Stack>
      </Box>
    </Box>
  )
}
