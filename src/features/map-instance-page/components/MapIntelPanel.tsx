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
  Stack,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'
import type { MapIntelPanelProps } from '../types'

export function MapIntelPanel({
  mapIntel,
  mapIntelLoadError,
  mapIntelPanelOpen,
  bossIntelOpen,
  extractionsOpen,
  highValueLootOpen,
  setMapIntelPanelOpen,
  setBossIntelOpen,
  setExtractionsOpen,
  setHighValueLootOpen,
  isGuaranteedSpawnChance,
  renderExtractionCard,
  renderLootCard,
  onClose,
}: MapIntelPanelProps) {
  const { t } = useTranslation()
  return (
    <Box
      sx={{
        display: 'flex',
        height: 'auto',
        minHeight: 'fit-content',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 4,
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
            {(mapIntel?.mapNameZh || mapIntel?.mapNameEn) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {[mapIntel.mapNameZh, mapIntel.mapNameEn].filter(Boolean).join(' / ')}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => setMapIntelPanelOpen((prev) => !prev)}>
              {mapIntelPanelOpen ? t('mapInstance.collapse') : t('mapInstance.expand')}
            </Button>
            {onClose ? (
              <Button variant="text" size="small" color="inherit" onClick={onClose}>
                {t('mapInstance.closeTools')}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>

      {mapIntelPanelOpen ? (
        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            {mapIntelLoadError ? <Alert severity="error">{mapIntelLoadError}</Alert> : null}
            {mapIntel?.errorMessage ? <Alert severity="warning">{mapIntel.errorMessage}</Alert> : null}

            <Accordion
              expanded={bossIntelOpen}
              onChange={(_, expanded) => setBossIntelOpen(expanded)}
              disableGutters
            >
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

            <Accordion
              expanded={extractionsOpen}
              onChange={(_, expanded) => setExtractionsOpen(expanded)}
              disableGutters
            >
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

            <Accordion
              expanded={highValueLootOpen}
              onChange={(_, expanded) => setHighValueLootOpen(expanded)}
              disableGutters
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="subtitle2">{t('mapInstance.highValueLootTitle')}</Typography>
                  <Chip size="small" label={mapIntel?.highValueLoot.length ?? 0} variant="outlined" />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {mapIntel?.highValueLoot.length ? (
                    mapIntel.highValueLoot.map(renderLootCard)
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('mapInstance.highValueLootEmpty')}
                    </Typography>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Box>
      ) : null}
    </Box>
  )
}
