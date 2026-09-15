import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useSnackbar } from 'notistack'
import homeHeroBg from '../assets/images/home_hero_bg.png'
import { fetchAppVersion, type AppVersionInfo } from '../api/version'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import {
  getMapAssetUrl,
  TARKOV_MAP_PRESETS,
  type TarkovMapPreset,
} from '../constants/maps'
import { getRecentInstances, type RecentInstanceRecord } from '../features/recent-instances'

interface HomePageProps {
  onCreateInstance: (payload: { mapId: number; mapName: string }) => Promise<void>
  onJoinInstance: (instanceId: string) => Promise<void>
  onOpenSettings: () => void
}

const motionEase = [0.22, 1, 0.36, 1] as const

const formatSubVersion = (value?: string) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

const buildVersionLabel = (version: string, buildTime?: string) => {
  const subVersion = formatSubVersion(buildTime)
  return subVersion ? `v${version}.${subVersion}` : `v${version}`
}

export function HomePage({
  onCreateInstance,
  onJoinInstance,
  onOpenSettings,
}: HomePageProps) {
  const { t, i18n } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const prefersReducedMotion = useReducedMotion()
  const mapPresets = TARKOV_MAP_PRESETS
  const [creatingMapId, setCreatingMapId] = useState<string | null>(null)
  const [selectedMapId, setSelectedMapId] = useState<number | null>(
    () => TARKOV_MAP_PRESETS[0]?.id ?? null,
  )
  const [joinExpanded, setJoinExpanded] = useState(false)
  const [instanceIdInput, setInstanceIdInput] = useState('')
  const [recentInstances, setRecentInstances] = useState<RecentInstanceRecord[]>([])
  const [appVersion, setAppVersion] = useState<AppVersionInfo | null>(null)

  const frontendVersionLabel = useMemo(
    () => buildVersionLabel(__APP_VERSION__, __BUILD_TIME__),
    [],
  )
  const backendVersionLabel = appVersion
    ? buildVersionLabel(appVersion.version, appVersion.buildTime)
    : null
  const versionsMatch = !appVersion?.version || appVersion.version === __APP_VERSION__

  useEffect(() => {
    setRecentInstances(getRecentInstances())
  }, [])

  useEffect(() => {
    const loadAppVersion = () => {
      void fetchAppVersion().then(setAppVersion)
    }
    loadAppVersion()
    window.addEventListener('api-base-url-changed', loadAppVersion)
    return () => window.removeEventListener('api-base-url-changed', loadAppVersion)
  }, [])

  const renderMapName = useCallback(
    (preset: TarkovMapPreset) => {
      const zh = preset.nameZh?.trim()
      const en = preset.nameEn?.trim()
      if (i18n.language.startsWith('zh')) {
        return zh || en || String(preset.id)
      }
      return en || zh || String(preset.id)
    },
    [i18n.language],
  )

  const selectedMap = useMemo(
    () => mapPresets.find((item) => item.id === selectedMapId) ?? null,
    [mapPresets, selectedMapId],
  )

  const createInstance = async (preset: TarkovMapPreset) => {
    try {
      setCreatingMapId(String(preset.id))
      await onCreateInstance({ mapId: preset.id, mapName: renderMapName(preset) })
    } catch (error) {
      console.warn('[HomePage] Create instance failed', error)
    } finally {
      setCreatingMapId(null)
    }
  }

  const joinInstance = async (instanceId: string) => {
    const nextId = instanceId.trim()
    if (!nextId) {
      enqueueSnackbar(t('home.instanceIdRequired'), { variant: 'error' })
      return
    }

    try {
      await onJoinInstance(nextId)
    } catch (error) {
      console.warn('[HomePage] Join instance failed', error)
    }
  }

  const formatCreatedAt = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `linear-gradient(90deg, rgba(4, 8, 11, 0.9) 0%, rgba(4, 8, 11, 0.72) 43%, rgba(4, 8, 11, 0.82) 100%), linear-gradient(180deg, rgba(4, 8, 11, 0.2), rgba(4, 8, 11, 0.9)), url(${homeHeroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(0.72) contrast(1.04)',
          transform: 'scale(1.01)',
        }}
      />

      <Box
        component="header"
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
        sx={{
          position: 'relative',
          zIndex: 40,
          minHeight: 'calc(70px + var(--desktop-titlebar-safe-top))',
          pt: 'var(--desktop-titlebar-safe-top)',
          px: { xs: 2, md: 3 },
          pr: { xs: 2, md: 'calc(24px + var(--desktop-window-controls-width))' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(157, 171, 183, 0.16)',
          backgroundColor: 'rgba(4, 9, 13, 0.8)',
          backdropFilter: 'blur(20px) saturate(118%)',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid rgba(207, 177, 111, 0.28)',
              borderRadius: 1.5,
              color: 'primary.main',
              backgroundColor: 'rgba(207, 177, 111, 0.06)',
              flexShrink: 0,
            }}
          >
            <TrackChangesRoundedIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: { xs: '0.92rem', sm: '1.15rem' }, fontWeight: 700 }} noWrap>
              Tarkov Tactical Board
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' }, textTransform: 'uppercase' }}
            >
              Plan · Mark · Sync
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 1 }}
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
          sx={{ alignItems: 'center', flexShrink: 0 }}
        >
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <LanguageSwitcher inline />
          </Box>
          <Tooltip title={t('settings.title')}>
            <IconButton onClick={onOpenSettings} aria-label={t('settings.title')}>
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 1600,
          mx: 'auto',
          p: { xs: 2, md: 3 },
          minHeight: 'calc(100vh - 112px - var(--desktop-titlebar-safe-top))',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(380px, 0.82fr) minmax(600px, 1.18fr)' },
          gap: { xs: 2, md: 3 },
          alignItems: 'stretch',
        }}
      >
        <motion.section
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.42, ease: motionEase }}
          style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <Box sx={{ px: { xs: 0.5, md: 1.5 }, py: { xs: 2, lg: 0 } }}>
            <Typography
              variant="h2"
              sx={{
                maxWidth: 620,
                fontSize: { xs: '2rem', sm: '2.5rem', xl: '3rem' },
                lineHeight: 1.08,
                textShadow: '0 3px 24px rgba(0,0,0,0.54)',
              }}
            >
              Tarkov Tactical Board
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ mt: 1.25, maxWidth: 560, fontSize: { xs: '0.92rem', md: '1rem' } }}
            >
              {t('home.subtitle')}
            </Typography>

            <Box
              sx={{
                mt: { xs: 3, md: 4 },
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<AddRoundedIcon />}
                endIcon={<ArrowForwardRoundedIcon />}
                disabled={!selectedMap || creatingMapId !== null}
                onClick={() => selectedMap && void createInstance(selectedMap)}
                sx={{ minHeight: 62, justifyContent: 'space-between', px: 2.5 }}
              >
                {creatingMapId ? t('common.loading') : t('home.createInstance')}
              </Button>
              <Button
                variant={joinExpanded ? 'contained' : 'outlined'}
                color="secondary"
                size="large"
                startIcon={<GroupsOutlinedIcon />}
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => setJoinExpanded((value) => !value)}
                sx={{ minHeight: 62, justifyContent: 'space-between', px: 2.5 }}
              >
                {t('home.enterInstance')}
              </Button>
            </Box>

            <AnimatePresence initial={false}>
              {joinExpanded && (
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
                  transition={{ duration: 0.24, ease: motionEase }}
                  style={{ overflow: 'hidden' }}
                >
                  <Stack direction="row" spacing={1} sx={{ pt: 1.5 }}>
                    <TextField
                      size="small"
                      fullWidth
                      autoFocus
                      placeholder={t('home.instanceIdPlaceholder')}
                      value={instanceIdInput}
                      onChange={(event) => setInstanceIdInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void joinInstance(instanceIdInput)
                      }}
                    />
                    <IconButton
                      color="secondary"
                      onClick={() => void joinInstance(instanceIdInput)}
                      aria-label={t('home.enterInstance')}
                      sx={{ border: '1px solid rgba(107, 173, 238, 0.45)', borderRadius: 1 }}
                    >
                      <ArrowForwardRoundedIcon />
                    </IconButton>
                  </Stack>
                </motion.div>
              )}
            </AnimatePresence>

            <Paper
              variant="outlined"
              sx={{ mt: { xs: 3, md: 4 }, p: { xs: 1.5, md: 2 }, backgroundColor: 'rgba(7, 14, 19, 0.72)' }}
            >
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>
                  {t('home.recentInstancesTitle')}
                </Typography>
              </Stack>

              <Stack spacing={0} sx={{ mt: 1.25 }}>
                {recentInstances.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t('home.recentInstancesEmpty')}
                  </Typography>
                ) : (
                  recentInstances.map((item) => (
                    <Box
                      key={item.instanceId}
                      component="button"
                      type="button"
                      onClick={() => void joinInstance(item.instanceId)}
                      sx={{
                        width: '100%',
                        py: 1.15,
                        px: 0.5,
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                        gap: 1.5,
                        alignItems: 'center',
                        color: 'inherit',
                        textAlign: 'left',
                        border: 0,
                        borderTop: '1px solid rgba(157, 171, 183, 0.12)',
                        background: 'transparent',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.035)' },
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{item.mapName}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{item.instanceId}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                        {formatCreatedAt(item.createdAt)}
                      </Typography>
                      <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </Box>
                  ))
                )}
              </Stack>
            </Paper>
          </Box>
        </motion.section>

        <motion.section
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.985 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.46, delay: prefersReducedMotion ? 0 : 0.06, ease: motionEase }}
          style={{ minWidth: 0 }}
        >
          <Paper
            sx={{
              height: { xs: 'auto', lg: 'calc(100vh - 160px - var(--desktop-titlebar-safe-top))' },
              minHeight: { lg: 620 },
              p: { xs: 1.5, md: 2 },
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(7, 14, 19, 0.8)',
              boxShadow: '0 28px 80px rgba(0, 0, 0, 0.36)',
            }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.75 }}>
              <MapOutlinedIcon color="primary" />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">{t('home.mapListTitle')}</Typography>
                {selectedMap && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {t('home.selectedMap')}: {renderMapName(selectedMap)}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Box
              sx={{
                minHeight: 0,
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
                gridAutoRows: 'minmax(210px, 1fr)',
                gap: 1.25,
                pr: 0.5,
              }}
            >
              {mapPresets.map((preset, index) => {
                  const selected = preset.id === selectedMapId
                  const bannerSrc = getMapAssetUrl(preset.bannerFileName)
                  const creating = creatingMapId === String(preset.id)

                  return (
                    <motion.button
                      key={preset.id}
                      type="button"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: prefersReducedMotion ? 0 : index * 0.025, ease: motionEase }}
                      whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                      onClick={() => setSelectedMapId(preset.id)}
                      onDoubleClick={() => void createInstance(preset)}
                      aria-pressed={selected}
                      style={{
                        minWidth: 0,
                        minHeight: 210,
                        padding: 0,
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 7,
                        border: selected ? '1px solid rgba(215, 185, 119, 0.9)' : '1px solid rgba(157, 171, 183, 0.2)',
                        background: '#10171d',
                        color: 'inherit',
                        textAlign: 'left',
                        boxShadow: selected ? '0 0 0 1px rgba(215, 185, 119, 0.2)' : 'none',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: bannerSrc
                            ? `linear-gradient(180deg, rgba(3,7,10,0.04) 28%, rgba(3,7,10,0.92) 100%), url(${bannerSrc})`
                            : 'linear-gradient(145deg, #202b33, #0a1015)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          transition: 'transform 420ms var(--motion-ease-out), filter 220ms var(--motion-ease-out)',
                          filter: selected ? 'saturate(1.04) brightness(1.05)' : 'saturate(0.82) brightness(0.92)',
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 'auto 0 0',
                          p: 1.4,
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{renderMapName(preset)}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {i18n.language.startsWith('zh') ? preset.nameEn : preset.nameZh}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          color={selected ? 'primary' : 'inherit'}
                          disabled={creatingMapId !== null}
                          aria-label={t('home.createInstance')}
                          onClick={(event) => {
                            event.stopPropagation()
                            void createInstance(preset)
                          }}
                          sx={{
                            width: 32,
                            height: 32,
                            flexShrink: 0,
                            border: '1px solid rgba(255,255,255,0.34)',
                            backgroundColor: 'rgba(3,8,11,0.58)',
                          }}
                        >
                          {creating ? <CircularProgress size={15} color="inherit" /> : <ArrowForwardRoundedIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                    </motion.button>
                  )
                })}
            </Box>
          </Paper>
        </motion.section>
      </Box>

      <Box
        component="footer"
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: 42,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: '1px solid rgba(157, 171, 183, 0.12)',
          backgroundColor: 'rgba(4, 9, 13, 0.72)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            {t('home.copyrightTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · {t('home.versionFrontend')} {frontendVersionLabel}
          </Typography>
          <Typography
            variant="caption"
            color={versionsMatch ? 'text.secondary' : 'warning.main'}
            title={versionsMatch ? undefined : t('home.versionMismatch')}
          >
            · {t('home.versionBackend')} {backendVersionLabel ?? '-'}
          </Typography>
        </Stack>
      </Box>

    </Box>
  )
}
