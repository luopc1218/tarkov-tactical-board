import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  CardMedia,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  getAdminMapIntelMap,
  listAdminMapIntelMaps,
  syncAdminMapIntelMap,
  syncAllAdminMapIntelMaps,
  type AdminMapIntelDetail,
  type AdminMapIntelSummary,
} from '../../api/admin-map-intel'
import { openExternalUrl } from '../../lib/desktop'
import { AdminShell } from './AdminShell'

interface AdminMapIntelPageProps {
  onNavigate: (path: string) => void
  onLogout: () => void
}

export function AdminMapIntelPage({ onNavigate, onLogout }: AdminMapIntelPageProps) {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<AdminMapIntelSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingMapId, setSyncingMapId] = useState<number | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [detailMapId, setDetailMapId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<AdminMapIntelDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return '-'
    }

    const parsed = dayjs(value)
    if (!parsed.isValid()) {
      return value
    }

    return parsed.format('YYYY-MM-DD HH:mm:ss')
  }

  const resolveMapName = useCallback(
    (item: Pick<AdminMapIntelSummary, 'mapId' | 'mapNameZh' | 'mapNameEn'>) => {
      if (i18n.language.startsWith('zh')) {
        return item.mapNameZh?.trim() || item.mapNameEn?.trim() || String(item.mapId)
      }
      return item.mapNameEn?.trim() || item.mapNameZh?.trim() || String(item.mapId)
    },
    [i18n.language],
  )

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const data = await listAdminMapIntelMaps()
      setItems(data)
    } catch (error) {
      console.warn('[AdminMapIntelPage] Load map intel list failed', error)
      setLoadError(error instanceof Error ? error.message : t('admin.mapIntelLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      void loadItems()
    }
  }, [loadItems])

  const syncedCount = useMemo(
    () => items.filter((item) => item.syncedAt !== null).length,
    [items],
  )

  const handleSyncMap = async (mapId: number) => {
    try {
      setSyncingMapId(mapId)
      await syncAdminMapIntelMap(mapId)
      await loadItems()
      if (detailMapId === mapId) {
        setDetailLoading(true)
        setDetailError(null)
        const detailResult = await getAdminMapIntelMap(mapId)
        setDetail(detailResult)
      }
    } catch (error) {
      console.warn('[AdminMapIntelPage] Sync single map intel failed', error)
    } finally {
      setSyncingMapId(null)
      setDetailLoading(false)
    }
  }

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true)
      await syncAllAdminMapIntelMaps()
      await loadItems()
      if (detailMapId !== null) {
        setDetailLoading(true)
        setDetailError(null)
        const detailResult = await getAdminMapIntelMap(detailMapId)
        setDetail(detailResult)
      }
    } catch (error) {
      console.warn('[AdminMapIntelPage] Sync all map intel failed', error)
    } finally {
      setSyncingAll(false)
      setDetailLoading(false)
    }
  }

  const handleOpenDetail = async (mapId: number) => {
    try {
      setDetailMapId(mapId)
      setDetail(null)
      setDetailError(null)
      setDetailLoading(true)
      const result = await getAdminMapIntelMap(mapId)
      setDetail(result)
    } catch (error) {
      console.warn('[AdminMapIntelPage] Load map intel detail failed', error)
      setDetailError(error instanceof Error ? error.message : t('admin.mapIntelDetailLoadError'))
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetailDialog = () => {
    setDetailMapId(null)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(false)
  }

  return (
    <AdminShell
      current="map-intel"
      title={t('admin.mapIntelTitle')}
      subtitle={t('admin.mapIntelSubtitle')}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerActions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            label={t('admin.mapIntelSyncProgress', {
              synced: syncedCount,
              total: items.length,
            })}
            variant="outlined"
          />
          <Button onClick={() => void loadItems()} variant="outlined" color="inherit">
            {t('admin.reloadMapIntel')}
          </Button>
          <Button onClick={() => void handleSyncAll()} disabled={loading || syncingAll} variant="contained">
            {syncingAll ? t('common.loading') : t('admin.syncAllMapIntel')}
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2} sx={{ height: '100%' }}>
        {loadError ? <Alert severity="error">{loadError}</Alert> : null}

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.mapIntelSyncedMaps')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 1 }}>
              {syncedCount} / {items.length}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.mapIntelUnsyncedMaps')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 1 }}>
              {Math.max(0, items.length - syncedCount)}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {t('admin.mapIntelDataSource')}
            </Typography>
            <Typography variant="h5" sx={{ mt: 1 }}>
              {t('admin.mapIntelSnapshotMode')}
            </Typography>
          </Paper>
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.mapId')}</TableCell>
                <TableCell>{t('admin.mapNameZh')}</TableCell>
                <TableCell>{t('admin.mapNameEn')}</TableCell>
                <TableCell>{t('admin.syncStatus')}</TableCell>
                <TableCell>{t('admin.lastSyncedAt')}</TableCell>
                <TableCell>{t('admin.bossRefreshTitle')}</TableCell>
                <TableCell>{t('admin.extractionsTitle')}</TableCell>
                <TableCell>{t('admin.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              )}

              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {t('admin.mapIntelEmpty')}
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                items.map((item) => {
                  const regularBossCount = item.bossRefresh.regular.length
                  const pveBossCount = item.bossRefresh.pve.length
                  const isSynced = item.syncedAt !== null

                  return (
                    <TableRow key={item.mapId} hover>
                      <TableCell>{item.mapId}</TableCell>
                      <TableCell>{item.mapNameZh || t('common.notAvailable')}</TableCell>
                      <TableCell>{item.mapNameEn || t('common.notAvailable')}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={isSynced ? 'success' : 'default'}
                          label={isSynced ? t('admin.synced') : t('admin.unsynced')}
                          variant={isSynced ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>{formatDateTime(item.syncedAt)}</TableCell>
                      <TableCell>{regularBossCount + pveBossCount}</TableCell>
                      <TableCell>{item.extractions.length}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => void handleSyncMap(item.mapId)}
                            disabled={syncingAll || syncingMapId !== null}
                          >
                            {syncingMapId === item.mapId ? t('common.loading') : t('admin.sync')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={() => void handleOpenDetail(item.mapId)}
                          >
                            {t('admin.viewDetails')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      {detailMapId !== null && (
        <Dialog open onClose={closeDetailDialog} fullWidth maxWidth="md">
          <DialogTitle>
            {detail
              ? t('admin.mapIntelDetailTitle', { mapName: resolveMapName(detail) })
              : t('admin.mapIntelDetailFallbackTitle', { mapId: detailMapId })}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {detailLoading ? <Alert severity="info">{t('common.loading')}</Alert> : null}
              {detailError ? <Alert severity="error">{detailError}</Alert> : null}
              {detail?.errorMessage ? <Alert severity="warning">{detail.errorMessage}</Alert> : null}

              {detail ? (
                <>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Chip label={`${t('admin.mapId')}: ${detail.mapId}`} variant="outlined" />
                    <Chip
                      label={
                        detail.syncedAt
                          ? `${t('admin.lastSyncedAt')}: ${formatDateTime(detail.syncedAt)}`
                          : t('admin.unsynced')
                      }
                      color={detail.syncedAt ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Stack>

                  <Box>
                    <Typography variant="subtitle1">{t('admin.bossRefreshTitle')}</Typography>
                    <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="subtitle2">{t('admin.bossRefreshRegular')}</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Stack spacing={1}>
                          {detail.bossRefresh.regular.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              {t('admin.unsyncedBossIntelHint')}
                            </Typography>
                          ) : (
                            detail.bossRefresh.regular.map((item) => (
                              <Stack
                                key={item.id}
                                direction="row"
                                spacing={1}
                                sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {item.name}
                                  </Typography>
                                  {item.nameSecondary ? (
                                    <Typography variant="caption" color="text.secondary">
                                      {item.nameSecondary}
                                    </Typography>
                                  ) : null}
                                </Box>
                                <Chip size="small" label={item.chanceText} />
                              </Stack>
                            ))
                          )}
                        </Stack>
                      </Paper>

                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="subtitle2">{t('admin.bossRefreshPve')}</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Stack spacing={1}>
                          {detail.bossRefresh.pve.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              {t('admin.unsyncedBossIntelHint')}
                            </Typography>
                          ) : (
                            detail.bossRefresh.pve.map((item) => (
                              <Stack
                                key={item.id}
                                direction="row"
                                spacing={1}
                                sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {item.name}
                                  </Typography>
                                  {item.nameSecondary ? (
                                    <Typography variant="caption" color="text.secondary">
                                      {item.nameSecondary}
                                    </Typography>
                                  ) : null}
                                </Box>
                                <Chip size="small" label={item.chanceText} />
                              </Stack>
                            ))
                          )}
                        </Stack>
                      </Paper>
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="subtitle1">{t('admin.extractionsTitle')}</Typography>
                    <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                      {detail.extractions.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          {t('admin.unsyncedExtractionIntelHint')}
                        </Typography>
                      ) : (
                        detail.extractions.map((item) => (
                          <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Stack spacing={0.75}>
                              <Typography variant="subtitle2">{item.name}</Typography>
                              {item.location ? (
                              <Typography variant="body2" color="text.secondary">
                                  {t('admin.location')}: {item.location}
                              </Typography>
                              ) : null}
                              {item.requirement ? (
                                <Typography variant="body2" color="text.secondary">
                                  {t('admin.requirement')}: {item.requirement}
                                </Typography>
                              ) : null}
                              {item.description ? (
                                <Typography variant="body2" color="text.secondary">
                                  {t('admin.description')}: {item.description}
                                </Typography>
                              ) : null}
                              {item.detailUrl ? (
                                <Link
                                  component="button"
                                  type="button"
                                  onClick={() => void openExternalUrl(item.detailUrl!)}
                                  underline="hover"
                                >
                                  {t('admin.viewDetails')}
                                </Link>
                              ) : null}
                              {item.detailImageUrls.length > 0 ? (
                                <CardMedia
                                  component="img"
                                  image={item.detailImageUrls[0]}
                                  alt={`${item.name}-${t('admin.detailImage')}`}
                                  sx={{
                                    borderRadius: 2,
                                    maxHeight: 240,
                                    objectFit: 'cover',
                                    border: 1,
                                    borderColor: 'divider',
                                  }}
                                />
                              ) : null}
                              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                                {item.factions.map((faction) => (
                                  <Chip key={`${item.id}-${faction}`} size="small" label={faction} variant="outlined" />
                                ))}
                              </Stack>
                            </Stack>
                          </Paper>
                        ))
                      )}
                    </Stack>
                  </Box>
                </>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            {detailMapId !== null ? (
              <Button
                onClick={() => void handleSyncMap(detailMapId)}
                disabled={syncingAll || syncingMapId !== null}
                variant="outlined"
              >
                {syncingMapId === detailMapId ? t('common.loading') : t('admin.sync')}
              </Button>
            ) : null}
            <Button onClick={closeDetailDialog}>{t('common.cancel')}</Button>
          </DialogActions>
        </Dialog>
      )}
    </AdminShell>
  )
}
