import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiArrowRight, FiCrosshair, FiMap, FiRefreshCw } from 'react-icons/fi'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useSnackbar } from 'notistack'
import homeHeroBg from '../assets/images/home_hero_bg.png'
import { fetchMapPresets, refreshMapPresets } from '../api/maps'
import type { TarkovMapPreset } from '../constants/maps'
import { getRecentInstances, type RecentInstanceRecord } from '../features/recent-instances'
import packageJson from '../../package.json'

const CUSTOM_MAP_BANNER_URL = homeHeroBg

interface HomePageProps {
  onCreateInstance: (payload: { mapId: number; mapName: string }) => Promise<void>
  onJoinInstance: (instanceId: string) => Promise<void>
  onOpenSettings: () => void
}

export function HomePage({ onCreateInstance, onJoinInstance, onOpenSettings }: HomePageProps) {
  const { t, i18n } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const [mapPresets, setMapPresets] = useState<TarkovMapPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [creatingMapId, setCreatingMapId] = useState<string | null>(null)
  const [instanceIdInput, setInstanceIdInput] = useState('')
  const [recentInstances, setRecentInstances] = useState<RecentInstanceRecord[]>([])

  const loadMapPresets = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true)
      setLoadFailed(false)
      const data = forceRefresh ? await refreshMapPresets() : await fetchMapPresets()
      console.log(data)
      setMapPresets(data)
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMapPresets()
  }, [loadMapPresets])

  useEffect(() => {
    setRecentInstances(getRecentInstances())
  }, [])

  const renderMapName = (preset: TarkovMapPreset) => {
    const zh = preset.nameZh?.trim()
    const en = preset.nameEn?.trim()
    if (i18n.language.startsWith('zh')) {
      return zh || (preset.id ? String(preset.id) : '-')
    }
    return en || (preset.id ? String(preset.id) : '-')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: 2,
        py: { xs: 4, md: 6 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: `linear-gradient(180deg, rgba(10,12,12,0.4) 0%, rgba(10,12,12,0.66) 54%, rgba(10,12,12,0.86) 100%), url(${homeHeroBg})`,
          backgroundSize: '100% 100%, 100% auto',
          backgroundPosition: 'center, top center',
          backgroundRepeat: 'no-repeat, no-repeat',
          backgroundBlendMode: 'multiply',
        }}
      />

      <Box sx={{ mx: 'auto', width: '100%', maxWidth: 1200, position: 'relative', zIndex: 1 }}>
        <Stack spacing={2} sx={{ mb: { xs: 5, md: 7 } }}>
          <Chip
            icon={<FiCrosshair />}
            label="Tarkov Map Board"
            sx={{ width: 'fit-content' }}
            variant="outlined"
          />
          <Typography variant="h2" sx={{ maxWidth: 820 }}>
            {t('home.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
            {t('home.subtitle')}
          </Typography>
        </Stack>

        <Paper
          className="lift-on-hover"
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 3,
            backgroundColor: 'rgba(20, 26, 34, 0.58)',
            backdropFilter: 'blur(18px) saturate(128%)',
          }}
        >
          <Typography variant="h6">{t('home.joinByInstance')}</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
            <TextField
              label={t('home.instanceId')}
              fullWidth
              placeholder={t('home.instanceIdPlaceholder')}
              value={instanceIdInput}
              onChange={(event) => setInstanceIdInput(event.target.value)}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              endIcon={<FiArrowRight />}
              onClick={async () => {
                const nextId = instanceIdInput.trim()
                if (!nextId) {
                  enqueueSnackbar(t('home.instanceIdRequired'), { variant: 'error' })
                  return
                }
                try {
                  await onJoinInstance(nextId)
                } catch (error) {
                  console.warn('[HomePage] Join instance failed', error)
                }
              }}
              sx={{ minWidth: 'fit-content', whiteSpace: 'nowrap' }}
            >
              {t('home.enterInstance')}
            </Button>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            {t('home.recentInstancesTitle')}
          </Typography>
          <Box sx={{ mt: 1 }}>
            {recentInstances.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                {t('home.recentInstancesEmpty')}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {recentInstances.map((item) => (
                  <Paper
                    key={item.instanceId}
                    variant="outlined"
                    sx={{
                      p: 1.2,
                      backgroundColor: 'rgba(20, 26, 34, 0.42)',
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {item.mapName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.instanceId}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={async () => {
                          try {
                            await onJoinInstance(item.instanceId)
                          } catch (error) {
                            console.warn('[HomePage] Join recent instance failed', error)
                          }
                        }}
                      >
                        {t('home.enterInstance')}
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Paper>

        {loading && (
          <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">{t('home.loadingMaps')}</Typography>
          </Stack>
        )}

        {!loading && loadFailed && (
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<FiRefreshCw />}
            onClick={() => void loadMapPresets(true)}
          >
            {t('common.retry')}
          </Button>
        )}

        {!loading && !loadFailed && mapPresets.length === 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography>{t('home.emptyMaps')}</Typography>
          </Paper>
        )}

        {!loading && !loadFailed && mapPresets.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
            }}
          >
            {mapPresets.map((preset, index) => {
              const bannerSrc = preset.bannerFileName

              return (
                <motion.article
                  key={preset.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: index * 0.024, ease: [0.22, 1, 0.36, 1] }}
                  style={{ borderRadius: 14, overflow: 'hidden' }}
                >
                  <Card
                    className="lift-on-hover"
                    sx={{
                      backgroundColor: 'rgba(20, 26, 34, 0.56)',
                      backdropFilter: 'blur(16px) saturate(122%)',
                    }}
                  >
                    <CardMedia
                      component="div"
                      sx={{
                        height: 160,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundImage: bannerSrc
                          ? `linear-gradient(180deg, rgba(15,23,42,0.16) 0%, rgba(15,23,42,0.7) 100%), url(${bannerSrc})`
                          : 'linear-gradient(160deg, rgba(55,65,81,0.78) 0%, rgba(30,41,59,0.88) 100%)',
                      }}
                    />
                    <CardContent>
                      <Stack
                        direction="row"
                        sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <Typography variant="h6">{renderMapName(preset)}</Typography>
                        <FiMap />
                      </Stack>
                      <Button
                        variant="contained"
                        endIcon={<FiArrowRight />}
                        onClick={async () => {
                          try {
                            setCreatingMapId(preset.id.toString())
                            await onCreateInstance({
                              mapId: preset.id,
                              mapName: renderMapName(preset),
                            })
                          } catch (error) {
                            console.warn('[HomePage] Create instance failed', error)
                          } finally {
                            setCreatingMapId(null)
                          }
                        }}
                        disabled={creatingMapId !== null}
                      >
                        {creatingMapId === preset.id.toString()
                          ? t('common.loading')
                          : t('home.createInstance')}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.article>
              )
            })}
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.24,
                delay: mapPresets.length * 0.024,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ borderRadius: 14, overflow: 'hidden' }}
            >
              <Card variant="outlined" sx={{ borderStyle: 'dashed' }}>
                <CardMedia
                  component="div"
                  sx={{
                    height: 160,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.2) 0%, rgba(15,23,42,0.72) 100%), url(${CUSTOM_MAP_BANNER_URL})`,
                  }}
                />
                <CardContent>
                  <Stack
                    direction="row"
                    sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="h6">{t('home.customMapTitle')}</Typography>
                    <FiMap />
                  </Stack>
                  <Button variant="outlined" color="inherit" disabled>
                    {t('home.comingSoon')}
                  </Button>
                </CardContent>
              </Card>
            </motion.article>
          </Box>
        )}

        <Paper
          variant="outlined"
          sx={{
            mt: { xs: 4, md: 5 },
            p: { xs: 2.25, md: 2.75 },
            borderRadius: 3,
            background:
              'linear-gradient(135deg, rgba(10, 15, 21, 0.72), rgba(17, 24, 32, 0.78) 52%, rgba(18, 52, 86, 0.34) 100%)',
            borderColor: 'rgba(148, 163, 184, 0.18)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={{ xs: 2.5, lg: 3 }}
            sx={{
              alignItems: { xs: 'stretch', lg: 'flex-start' },
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ minWidth: 0, maxWidth: 760 }}>
              <Typography variant="overline" color="text.secondary">
                {t('home.footerLabel')}
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                {t('home.footerTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('home.footerDesc1')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {t('home.footerDesc2')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('home.footerSource')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1.25, display: 'block' }}
              >
                {t('home.copyrightTitle')} | v{packageJson.version}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<SettingsOutlinedIcon />}
              onClick={onOpenSettings}
              sx={{
                alignSelf: { xs: 'stretch', lg: 'center' },
                borderColor: 'rgba(148, 163, 184, 0.28)',
                backgroundColor: 'rgba(15, 23, 42, 0.22)',
              }}
            >
              {t('settings.title')}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  )
}
