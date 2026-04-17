import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiArrowDown, FiArrowUp } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  createAdminMap,
  deleteAdminMap,
  listAdminMaps,
  reorderAdminMaps,
  updateAdminMap,
} from '../../api/admin-maps'
import { resolveImagePath } from '../../api/files'
import type { AdminMap, AdminMapUpsertRequest } from '../../types/admin'
import { AdminShell } from './AdminShell'

interface AdminMapsPageProps {
  onNavigate: (path: string) => void
  onLogout: () => void
}

const EMPTY_FORM: AdminMapUpsertRequest = {
  nameZh: '',
  nameEn: '',
  bannerFileName: '',
  mapFileName: '',
}

const extractFileName = (value: string) => {
  return value
    .trim()
    .replace(/\\/g, '/')
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean)
    .pop() ?? ''
}

export function AdminMapsPage({ onNavigate, onLogout }: AdminMapsPageProps) {
  const { t, i18n } = useTranslation()
  const [maps, setMaps] = useState<AdminMap[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMap, setEditingMap] = useState<AdminMap | null>(null)
  const [form, setForm] = useState<AdminMapUpsertRequest>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [movingId, setMovingId] = useState<number | null>(null)
  const [pendingDeleteMap, setPendingDeleteMap] = useState<AdminMap | null>(null)
  const hasLoadedRef = useRef(false)

  const canSubmit = useMemo(() => {
    return Boolean(
      form.nameZh.trim() &&
      form.nameEn.trim() &&
      (form.bannerFileName ?? '').trim() &&
      (form.mapFileName ?? '').trim()
    )
  }, [form])

  const loadMaps = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listAdminMaps()
      setMaps(data)
    } catch (error) {
      console.warn('[AdminMapsPage] Load maps failed', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      void loadMaps()
    }
  }, [loadMaps])

  const openCreateModal = () => {
    setEditingMap(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEditModal = (item: AdminMap) => {
    setEditingMap(item)
    setForm({
      nameZh: item.nameZh ?? '',
      nameEn: item.nameEn ?? '',
      bannerFileName: extractFileName(item.bannerFileName ?? item.bannerUrl ?? ''),
      mapFileName: extractFileName(item.mapFileName ?? item.mapUrl ?? ''),
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSaving(false)
    setEditingMap(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = async () => {
    if (!canSubmit) {
      return
    }

    const payload: AdminMapUpsertRequest = {
      nameZh: form.nameZh.trim(),
      nameEn: form.nameEn.trim(),
      bannerFileName: form.bannerFileName.trim(),
      mapFileName: form.mapFileName.trim(),
    }

    try {
      setSaving(true)

      if (editingMap) {
        const updated = await updateAdminMap(editingMap.id, payload)
        setMaps((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      } else {
        const created = await createAdminMap(payload)
        setMaps((prev) => [...prev, created])
      }

      closeModal()
    } catch (error) {
      console.warn('[AdminMapsPage] Submit map failed', error)
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id)
      await deleteAdminMap(id)
      setMaps((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      console.warn('[AdminMapsPage] Delete map failed', error)
    } finally {
      setDeletingId(null)
    }
  }

  const openDeleteConfirm = (item: AdminMap) => {
    setPendingDeleteMap(item)
  }

  const closeDeleteConfirm = () => {
    setPendingDeleteMap(null)
  }

  const resolveLocalizedMapName = (item: AdminMap) => {
    if (i18n.language.startsWith('zh')) {
      return item.nameZh?.trim() || String(item.id)
    }
    return item.nameEn?.trim() || String(item.id)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteMap) {
      return
    }

    await handleDelete(pendingDeleteMap.id)
    setPendingDeleteMap(null)
  }

  const handleMove = async (id: number, direction: 'up' | 'down') => {
    const currentIndex = maps.findIndex((item) => item.id === id)
    if (currentIndex < 0) {
      return
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= maps.length) {
      return
    }

    const next = [...maps]
    const [current] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, current)

    try {
      setMovingId(id)
      const reordered = await reorderAdminMaps(next.map((item) => item.id))
      setMaps(reordered.length > 0 ? reordered : next)
    } catch (error) {
      console.warn('[AdminMapsPage] Reorder maps failed', error)
    } finally {
      setMovingId(null)
    }
  }

  return (
    <AdminShell
      current="maps"
      title={t('admin.mapsTitle')}
      subtitle={t('admin.mapsSubtitle')}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerActions={
        <Stack direction="row" spacing={1}>
          <Button onClick={() => void loadMaps()} variant="outlined" color="inherit">
            {t('admin.reloadMaps')}
          </Button>
          <Button onClick={openCreateModal} variant="contained">
            {t('admin.createMap')}
          </Button>
        </Stack>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.id')}</TableCell>
                <TableCell>{t('admin.banner')}</TableCell>
                <TableCell>{t('admin.mapNameZh')}</TableCell>
                <TableCell>{t('admin.mapNameEn')}</TableCell>
                <TableCell>{t('admin.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              )}

              {!loading && maps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {t('admin.mapsEmpty')}
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                maps.map((item) => {
                  const bannerPreview = resolveImagePath(item.bannerUrl || item.bannerFileName)

                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>
                        <Box sx={{ height: 56, width: 96, overflow: 'hidden', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                          {bannerPreview ? (
                            <img
                              src={bannerPreview}
                              alt={item.nameEn || item.nameZh || `map-${item.id}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Typography variant="caption">{t('common.notAvailable')}</Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{item.nameZh}</TableCell>
                      <TableCell>{item.nameEn}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            onClick={() => void handleMove(item.id, 'up')}
                            disabled={movingId !== null || maps[0]?.id === item.id}
                            variant="outlined"
                            color="inherit"
                            startIcon={<FiArrowUp />}
                          >
                            {t('admin.moveUp')}
                          </Button>
                          <Button
                            size="small"
                            onClick={() => void handleMove(item.id, 'down')}
                            disabled={movingId !== null || maps[maps.length - 1]?.id === item.id}
                            variant="outlined"
                            color="inherit"
                            startIcon={<FiArrowDown />}
                          >
                            {t('admin.moveDown')}
                          </Button>
                          <Button size="small" onClick={() => openEditModal(item)} variant="outlined" color="inherit">
                            {t('admin.editMap')}
                          </Button>
                          <Button
                            size="small"
                            onClick={() => openDeleteConfirm(item)}
                            disabled={deletingId === item.id}
                            variant="outlined"
                            color="error"
                          >
                            {deletingId === item.id ? t('common.loading') : t('admin.delete')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {modalOpen && (
        <Dialog open onClose={closeModal} fullWidth maxWidth="md">
          <DialogTitle>{editingMap ? t('admin.editMap') : t('admin.createMap')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('admin.mapFormHint')}
            </Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label={t('admin.mapNameZh')}
                    value={form.nameZh}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, nameZh: event.target.value }))
                    }
                />
                <TextField
                  fullWidth
                  label={t('admin.mapNameEn')}
                    value={form.nameEn}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, nameEn: event.target.value }))
                    }
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label={t('admin.bannerFileName')}
                    value={form.bannerFileName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setForm((prev) => ({ ...prev, bannerFileName: event.target.value }))
                    }
                  placeholder="Banner_customs.png"
                />
                <TextField
                  fullWidth
                  label={t('admin.mapFileName')}
                    value={form.mapFileName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setForm((prev) => ({ ...prev, mapFileName: event.target.value }))
                    }
                  placeholder="Customs.png"
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeModal}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSubmit()} disabled={saving || !canSubmit} variant="contained">
              {saving ? t('common.loading') : editingMap ? t('admin.update') : t('admin.create')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {pendingDeleteMap && (
        <Dialog open onClose={closeDeleteConfirm} fullWidth maxWidth="xs">
          <DialogTitle>{t('admin.confirmDeleteTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {t('admin.confirmDeleteDesc', {
                mapName: resolveLocalizedMapName(pendingDeleteMap),
              })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteConfirm}>{t('common.cancel')}</Button>
            <Button onClick={() => void confirmDelete()} disabled={deletingId === pendingDeleteMap.id} color="error" variant="outlined">
                {deletingId === pendingDeleteMap.id ? t('common.loading') : t('admin.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </AdminShell>
  )
}
