import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createAdminMap, deleteAdminMap, listAdminMaps, updateAdminMap } from '../../api/admin-maps'
import { buildFileDownloadUrl, uploadFile } from '../../api/files'
import type { AdminMap, AdminMapUpsertRequest } from '../../types/admin'
import { AdminShell } from './AdminShell'

interface AdminMapsPageProps {
  onNavigate: (path: string) => void
  onLogout: () => void
}

const EMPTY_FORM: AdminMapUpsertRequest = {
  code: '',
  nameZh: '',
  nameEn: '',
  bannerObjectName: '',
  mapObjectName: '',
}

export function AdminMapsPage({ onNavigate, onLogout }: AdminMapsPageProps) {
  const { t } = useTranslation()
  const [maps, setMaps] = useState<AdminMap[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMap, setEditingMap] = useState<AdminMap | null>(null)
  const [form, setForm] = useState<AdminMapUpsertRequest>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingTarget, setUploadingTarget] = useState<'banner' | 'map' | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [pendingDeleteMap, setPendingDeleteMap] = useState<AdminMap | null>(null)

  const canSubmit = useMemo(() => {
    return Boolean(
      form.code.trim() &&
        form.nameZh.trim() &&
        form.nameEn.trim() &&
        form.bannerObjectName.trim() &&
        form.mapObjectName.trim(),
    )
  }, [form])

  const loadMaps = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const data = await listAdminMaps()
      setMaps(data)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('admin.mapsLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadMaps()
  }, [loadMaps])

  const openCreateModal = () => {
    setEditingMap(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEditModal = (item: AdminMap) => {
    setEditingMap(item)
    setForm({
      code: item.code,
      nameZh: item.nameZh,
      nameEn: item.nameEn,
      bannerObjectName: item.bannerObjectName,
      mapObjectName: item.mapObjectName,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSaving(false)
    setUploadingTarget(null)
    setEditingMap(null)
    setForm(EMPTY_FORM)
  }

  const handleUpload = async (target: 'banner' | 'map', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      setUploadingTarget(target)
      setErrorMessage(null)
      const objectName = await uploadFile(file)

      if (target === 'banner') {
        setForm((prev) => ({ ...prev, bannerObjectName: objectName }))
      } else {
        setForm((prev) => ({ ...prev, mapObjectName: objectName }))
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('admin.uploadFailed'))
    } finally {
      setUploadingTarget(null)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) {
      return
    }

    const payload: AdminMapUpsertRequest = {
      code: form.code.trim(),
      nameZh: form.nameZh.trim(),
      nameEn: form.nameEn.trim(),
      bannerObjectName: form.bannerObjectName.trim(),
      mapObjectName: form.mapObjectName.trim(),
    }

    try {
      setSaving(true)
      setErrorMessage(null)

      if (editingMap) {
        const updated = await updateAdminMap(editingMap.id, payload)
        setMaps((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      } else {
        const created = await createAdminMap(payload)
        setMaps((prev) => [...prev, created])
      }

      closeModal()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : editingMap
            ? t('admin.mapsUpdateError')
            : t('admin.mapsCreateError'),
      )
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id)
      setErrorMessage(null)
      await deleteAdminMap(id)
      setMaps((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('admin.mapsDeleteError'))
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

  const confirmDelete = async () => {
    if (!pendingDeleteMap) {
      return
    }

    await handleDelete(pendingDeleteMap.id)
    setPendingDeleteMap(null)
  }

  return (
    <AdminShell
      current="maps"
      title={t('admin.mapsTitle')}
      subtitle={t('admin.mapsSubtitle')}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerActions={
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadMaps()} className="btn-outline h-10 rounded-xl px-4">
            {t('admin.reloadMaps')}
          </button>
          <button type="button" onClick={openCreateModal} className="btn-primary h-10 rounded-xl px-4">
            {t('admin.createMap')}
          </button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        {errorMessage && (
          <p className="rounded-xl bg-rose-950/45 px-4 py-3 text-sm text-rose-200">{errorMessage}</p>
        )}

        <div className="scrollbar-tactical min-h-0 flex-1 overflow-auto rounded-xl border border-emerald-200/20">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-emerald-900/95 text-emerald-100 backdrop-blur">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">{t('admin.banner')}</th>
                <th className="px-4 py-3">{t('admin.mapCode')}</th>
                <th className="px-4 py-3">{t('admin.mapNameZh')}</th>
                <th className="px-4 py-3">{t('admin.mapNameEn')}</th>
                <th className="px-4 py-3">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-emerald-50/70">
                    {t('common.loading')}
                  </td>
                </tr>
              )}

              {!loading && maps.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-emerald-50/70">
                    {t('admin.mapsEmpty')}
                  </td>
                </tr>
              )}

              {!loading &&
                maps.map((item) => {
                  const bannerPreview = item.bannerUrl || buildFileDownloadUrl(item.bannerObjectName)

                  return (
                    <tr key={item.id} className="border-t border-emerald-200/15">
                      <td className="px-4 py-3 text-emerald-50/85">{item.id}</td>
                      <td className="px-4 py-3">
                        <div className="h-14 w-24 overflow-hidden rounded-md border border-emerald-200/20 bg-black/20">
                          {bannerPreview ? (
                            <img src={bannerPreview} alt={item.code} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[11px] text-emerald-100/50">
                              N/A
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white">{item.code}</td>
                      <td className="px-4 py-3 text-white">{item.nameZh}</td>
                      <td className="px-4 py-3 text-white">{item.nameEn}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="btn-outline h-9 rounded-lg px-3 text-xs"
                          >
                            {t('admin.editMap')}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteConfirm(item)}
                            disabled={deletingId === item.id}
                            className="h-9 rounded-lg border border-rose-300/45 px-3 text-xs font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            {deletingId === item.id ? t('common.loading') : t('admin.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-emerald-200/20 bg-[#102018] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">
              {editingMap ? t('admin.editMap') : t('admin.createMap')}
            </h2>
            <p className="mt-1 text-sm text-emerald-50/70">{t('admin.mapFormHint')}</p>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-emerald-100/80">{t('admin.mapCode')}</span>
                  <input
                    value={form.code}
                    onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder={t('admin.mapCode')}
                    className="w-full rounded-xl border border-emerald-200/20 bg-black/25 px-3 py-2.5 text-sm text-white placeholder:text-emerald-50/40 outline-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-emerald-100/80">{t('admin.mapNameZh')}</span>
                  <input
                    value={form.nameZh}
                    onChange={(event) => setForm((prev) => ({ ...prev, nameZh: event.target.value }))}
                    placeholder={t('admin.mapNameZh')}
                    className="w-full rounded-xl border border-emerald-200/20 bg-black/25 px-3 py-2.5 text-sm text-white placeholder:text-emerald-50/40 outline-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-emerald-100/80">{t('admin.mapNameEn')}</span>
                  <input
                    value={form.nameEn}
                    onChange={(event) => setForm((prev) => ({ ...prev, nameEn: event.target.value }))}
                    placeholder={t('admin.mapNameEn')}
                    className="w-full rounded-xl border border-emerald-200/20 bg-black/25 px-3 py-2.5 text-sm text-white placeholder:text-emerald-50/40 outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200/20 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-emerald-100/80">{t('admin.bannerUpload')}</p>
                    <label className="btn-outline inline-flex h-8 cursor-pointer items-center justify-center rounded-lg px-3 text-xs">
                      {uploadingTarget === 'banner' ? t('common.loading') : t('admin.upload')}
                      <input
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={(event) => void handleUpload('banner', event)}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-emerald-50/70 break-all">{form.bannerObjectName || '-'}</p>
                  {form.bannerObjectName && (
                    <div className="mt-2 h-24 overflow-hidden rounded-lg border border-emerald-200/15 bg-black/30">
                      <img
                        src={buildFileDownloadUrl(form.bannerObjectName)}
                        alt="banner preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-emerald-200/20 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-emerald-100/80">{t('admin.mapUpload')}</p>
                    <label className="btn-outline inline-flex h-8 cursor-pointer items-center justify-center rounded-lg px-3 text-xs">
                      {uploadingTarget === 'map' ? t('common.loading') : t('admin.upload')}
                      <input
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={(event) => void handleUpload('map', event)}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-emerald-50/70 break-all">{form.mapObjectName || '-'}</p>
                  {form.mapObjectName && (
                    <div className="mt-2 h-24 overflow-hidden rounded-lg border border-emerald-200/15 bg-black/30">
                      <img
                        src={buildFileDownloadUrl(form.mapObjectName)}
                        alt="map preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="btn-outline h-10 rounded-xl px-4">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving || uploadingTarget !== null || !canSubmit}
                className="btn-primary h-10 rounded-xl px-4 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {saving ? t('common.loading') : editingMap ? t('admin.update') : t('admin.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteMap && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-200/25 bg-[#1b1313] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">{t('admin.confirmDeleteTitle')}</h2>
            <p className="mt-2 text-sm text-rose-100/80">
              {t('admin.confirmDeleteDesc', { code: pendingDeleteMap.code })}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeDeleteConfirm} className="btn-outline h-10 rounded-xl px-4">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deletingId === pendingDeleteMap.id}
                className="h-10 rounded-xl border border-rose-300/45 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {deletingId === pendingDeleteMap.id ? t('common.loading') : t('admin.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
