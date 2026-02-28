import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createAdminMap, deleteAdminMap, listAdminMaps, updateAdminMap } from '../../api/admin-maps'
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
  bannerPath: '',
  mapPath: '',
}

export function AdminMapsPage({ onNavigate, onLogout }: AdminMapsPageProps) {
  const { t } = useTranslation()
  const [maps, setMaps] = useState<AdminMap[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMap, setEditingMap] = useState<AdminMap | null>(null)
  const [form, setForm] = useState<AdminMapUpsertRequest>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [pendingDeleteMap, setPendingDeleteMap] = useState<AdminMap | null>(null)

  const canSubmit = useMemo(() => {
    return Boolean(
      form.nameZh.trim() &&
      form.nameEn.trim() &&
      (form.bannerPath ?? '').trim() &&
      (form.mapPath ?? '').trim()
    )
  }, [form])

  const loadMaps = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listAdminMaps()
      setMaps(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

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
      nameZh: item.nameZh ?? '',
      nameEn: item.nameEn ?? '',
      bannerPath: item.bannerPath ?? item.bannerUrl ?? '',
      mapPath: item.mapPath ?? item.mapUrl ?? '',
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
      bannerPath: form.bannerPath.trim(),
      mapPath: form.mapPath.trim(),
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
    } catch {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id)
      await deleteAdminMap(id)
      setMaps((prev) => prev.filter((item) => item.id !== id))
    } catch {
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
          <button
            type="button"
            onClick={() => void loadMaps()}
            className="btn-outline h-9 rounded-lg px-3.5"
          >
            {t('admin.reloadMaps')}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary h-9 rounded-lg px-3.5"
          >
            {t('admin.createMap')}
          </button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="scrollbar-tactical min-h-0 flex-1 overflow-auto rounded-xl border border-slate-600/70">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900/98 text-slate-200 backdrop-blur">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">{t('admin.banner')}</th>
                <th className="px-4 py-3">{t('admin.mapNameZh')}</th>
                <th className="px-4 py-3">{t('admin.mapNameEn')}</th>
                <th className="px-4 py-3">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-300">
                    {t('common.loading')}
                  </td>
                </tr>
              )}

              {!loading && maps.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-300">
                    {t('admin.mapsEmpty')}
                  </td>
                </tr>
              )}

              {!loading &&
                maps.map((item) => {
                  const bannerPreview = resolveImagePath(item.bannerUrl || item.bannerPath)

                  return (
                    <tr key={item.id} className="border-t border-slate-700/70">
                      <td className="px-4 py-3 text-slate-300">{item.id}</td>
                      <td className="px-4 py-3">
                        <div className="h-14 w-24 overflow-hidden rounded-md border border-slate-600/70 bg-slate-900/80">
                          {bannerPreview ? (
                            <img
                              src={bannerPreview}
                              alt={item.nameEn || item.nameZh || `map-${item.id}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[11px] text-slate-400">
                              N/A
                            </div>
                          )}
                        </div>
                      </td>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
            <h2 className="text-xl font-semibold text-white">
              {editingMap ? t('admin.editMap') : t('admin.createMap')}
            </h2>
            <p className="mt-1 text-sm text-slate-300">{t('admin.mapFormHint')}</p>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">{t('admin.mapNameZh')}</span>
                  <input
                    value={form.nameZh}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, nameZh: event.target.value }))
                    }
                    placeholder={t('admin.mapNameZh')}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">{t('admin.mapNameEn')}</span>
                  <input
                    value={form.nameEn}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, nameEn: event.target.value }))
                    }
                    placeholder={t('admin.mapNameEn')}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-600/70 bg-slate-800/70 p-3">
                  <p className="text-xs font-medium text-slate-300">Banner Path</p>
                  <input
                    value={form.bannerPath}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setForm((prev) => ({ ...prev, bannerPath: event.target.value }))
                    }
                    placeholder="assets/images/tarkov-maps/banner/Banner_customs.png"
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                  <p className="text-xs text-slate-300 break-all">{form.bannerPath || '-'}</p>
                </div>

                <div className="rounded-xl border border-slate-600/70 bg-slate-800/70 p-3">
                  <p className="text-xs font-medium text-slate-300">Map Path</p>
                  <input
                    value={form.mapPath}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setForm((prev) => ({ ...prev, mapPath: event.target.value }))
                    }
                    placeholder="assets/images/tarkov-maps/Customs.png"
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                  <p className="text-xs text-slate-300 break-all">{form.mapPath || '-'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="btn-outline h-9 rounded-lg px-3.5"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving || !canSubmit}
                className="btn-primary h-9 rounded-lg px-3.5 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {saving ? t('common.loading') : editingMap ? t('admin.update') : t('admin.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteMap && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
            <h2 className="text-xl font-semibold text-white">{t('admin.confirmDeleteTitle')}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {t('admin.confirmDeleteDesc', {
                mapName: pendingDeleteMap.nameZh || pendingDeleteMap.nameEn || pendingDeleteMap.id,
              })}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="btn-outline h-9 rounded-lg px-3.5"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deletingId === pendingDeleteMap.id}
                className="h-9 rounded-lg border border-rose-300/45 px-3.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
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
