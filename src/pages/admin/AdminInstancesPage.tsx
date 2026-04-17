import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { FiCopy } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import {
  clearAllAdminWhiteboardInstances,
  deleteAdminWhiteboardInstance,
  listAdminWhiteboardInstances,
} from '../../api/admin-whiteboard'
import type { AdminWhiteboardInstance } from '../../types/admin'
import { AdminShell } from './AdminShell'

interface AdminInstancesPageProps {
  onNavigate: (path: string) => void
  onLogout: () => void
}

export function AdminInstancesPage({ onNavigate, onLogout }: AdminInstancesPageProps) {
  const { t, i18n } = useTranslation()
  const PAGE_SIZE_OPTIONS = [20, 50, 100]
  const [instances, setInstances] = useState<AdminWhiteboardInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [includeExpired, setIncludeExpired] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingClearAll, setPendingClearAll] = useState(false)
  const [copiedInstanceId, setCopiedInstanceId] = useState<string | null>(null)
  const copyFeedbackTimerRef = useRef<number | null>(null)
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

  const resolveMapName = (item: AdminWhiteboardInstance) => {
    const zh = item.mapNameZh?.trim()
    const en = item.mapNameEn?.trim()
    const fallback = item.mapName?.trim()
    if (i18n.language.startsWith('zh')) {
      return zh || fallback || (item.mapId != null ? String(item.mapId) : '-')
    }
    return en || fallback || (item.mapId != null ? String(item.mapId) : '-')
  }

  const loadInstances = useCallback(async () => {
    try {
      setLoading(true)
      const result = await listAdminWhiteboardInstances({
        includeExpired,
        page,
        size: pageSize,
      })
      setInstances(result.items)
      setTotal(result.total)
      setTotalPages(Math.max(1, result.pages))
      return result
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [includeExpired, page, pageSize])

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      void loadInstances()
    }
  }, [loadInstances])

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current)
      }
    }
  }, [])

  const handleCopyInstanceId = async (instanceId: string) => {
    try {
      await navigator.clipboard.writeText(instanceId)
      setCopiedInstanceId(instanceId)
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current)
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopiedInstanceId((current) => (current === instanceId ? null : current))
        copyFeedbackTimerRef.current = null
      }, 1600)
    } catch (error) {
      console.warn('[AdminInstancesPage] Copy instance id failed', error)
    }
  }

  const handleDelete = async (instanceId: string) => {
    try {
      setDeletingId(instanceId)
      await deleteAdminWhiteboardInstance(instanceId)
      const result = await loadInstances()
      if (result && result.items.length === 0 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1))
      }
    } catch (error) {
      console.warn('[AdminInstancesPage] Delete instance failed', error)
    } finally {
      setDeletingId(null)
      setPendingDeleteId(null)
    }
  }

  const handleClearAll = async () => {
    try {
      setClearingAll(true)
      await clearAllAdminWhiteboardInstances()
      const result = await listAdminWhiteboardInstances({
        includeExpired,
        page: 1,
        size: pageSize,
      })
      setInstances(result.items)
      setTotal(result.total)
      setTotalPages(Math.max(1, result.pages))
      setPage(1)
    } catch (error) {
      console.warn('[AdminInstancesPage] Clear all instances failed', error)
    } finally {
      setClearingAll(false)
      setPendingClearAll(false)
    }
  }

  return (
    <AdminShell
      current="instances"
      title={t('admin.instancesTitle')}
      subtitle={t('admin.instancesSubtitle')}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerActions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ToggleButtonGroup
            exclusive
            value={includeExpired ? 'all' : 'active'}
            onChange={(_, value) => {
              if (!value) return
              setIncludeExpired(value === 'all')
              setPage(1)
            }}
            size="small"
          >
            <ToggleButton value="active">
              {t('admin.active')}
            </ToggleButton>
            <ToggleButton value="all">
              {t('admin.includeExpired')}
            </ToggleButton>
          </ToggleButtonGroup>
          <Button onClick={() => void loadInstances()} variant="outlined" color="inherit">
            {t('admin.reloadInstances')}
          </Button>
          <Button onClick={() => setPendingClearAll(true)} disabled={loading || clearingAll} color="error" variant="outlined">
            {clearingAll ? t('common.loading') : t('admin.clearAllInstances')}
          </Button>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>{t('admin.pageSize')}</InputLabel>
            <Select
              label={t('admin.pageSize')}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <MenuItem key={size} value={size}>
                  {size}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      }
    >
      <Box sx={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column', gap: 2 }}>
        <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1280 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.instanceId')}</TableCell>
                <TableCell>{t('admin.mapName')}</TableCell>
                <TableCell>{t('admin.status')}</TableCell>
                <TableCell>{t('admin.hasState')}</TableCell>
                <TableCell>{t('admin.createdAt')}</TableCell>
                <TableCell>{t('admin.updatedAt')}</TableCell>
                <TableCell>{t('admin.expireAt')}</TableCell>
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

              {!loading && instances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {t('admin.instancesEmpty')}
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                instances.map((item) => (
                  <TableRow key={item.instanceId}>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                        <Typography variant="body2" noWrap title={item.instanceId} sx={{ minWidth: 0, flex: 1 }}>
                          {item.instanceId}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          onClick={() => void handleCopyInstanceId(item.instanceId)}
                          title={t('admin.copyInstanceId')}
                          aria-label={`${t('admin.copyInstanceId')}: ${item.instanceId}`}
                          startIcon={<FiCopy />}
                        >
                          {copiedInstanceId === item.instanceId ? t('admin.copied') : t('admin.copyInstanceId')}
                        </Button>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap title={resolveMapName(item)}>
                        {resolveMapName(item)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={item.active ? 'success' : 'error'}
                        variant="outlined"
                        label={item.active ? t('admin.active') : t('admin.expired')}
                      />
                    </TableCell>
                    <TableCell>{item.hasState ? t('admin.yes') : t('admin.no')}</TableCell>
                    <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                    <TableCell>{formatDateTime(item.expireAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => setPendingDeleteId(item.instanceId)}
                        disabled={deletingId === item.instanceId || clearingAll}
                        variant="outlined"
                        color="error"
                      >
                        {deletingId === item.instanceId ? t('common.loading') : t('admin.delete')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('admin.instancesTotal', { total })}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button
              size="small"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={loading || page <= 1}
              variant="outlined"
              color="inherit"
            >
              {t('admin.prevPage')}
            </Button>
            <Typography variant="body2" sx={{ minWidth: 120, textAlign: 'center' }}>
              {t('admin.pageInfo', { page, pages: Math.max(1, totalPages) })}
            </Typography>
            <Button
              size="small"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={loading || page >= totalPages}
              variant="outlined"
              color="inherit"
            >
              {t('admin.nextPage')}
            </Button>
          </Stack>
        </Stack>
      </Box>

      {pendingDeleteId && (
        <Dialog open onClose={() => setPendingDeleteId(null)} fullWidth maxWidth="xs">
          <DialogTitle>{t('admin.confirmDeleteInstanceTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {t('admin.confirmDeleteInstanceDesc', { instanceId: pendingDeleteId })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPendingDeleteId(null)}>{t('common.cancel')}</Button>
            <Button
                onClick={() => void handleDelete(pendingDeleteId)}
                disabled={deletingId === pendingDeleteId}
                color="error"
                variant="outlined"
              >
                {deletingId === pendingDeleteId ? t('common.loading') : t('admin.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {pendingClearAll && (
        <Dialog open onClose={() => setPendingClearAll(false)} fullWidth maxWidth="xs">
          <DialogTitle>{t('admin.confirmClearInstancesTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">{t('admin.confirmClearInstancesDesc')}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPendingClearAll(false)}>{t('common.cancel')}</Button>
            <Button
                onClick={() => void handleClearAll()}
                disabled={clearingAll}
                color="error"
                variant="outlined"
              >
                {clearingAll ? t('common.loading') : t('admin.clearAllInstances')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </AdminShell>
  )
}
