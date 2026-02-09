import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
  const { t } = useTranslation()
  const [instances, setInstances] = useState<AdminWhiteboardInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [includeExpired, setIncludeExpired] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const loadInstances = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const data = await listAdminWhiteboardInstances(includeExpired)
      setInstances(data)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('admin.instancesLoadError'))
    } finally {
      setLoading(false)
    }
  }, [includeExpired, t])

  useEffect(() => {
    void loadInstances()
  }, [loadInstances])

  const handleDelete = async (instanceId: string) => {
    try {
      setDeletingId(instanceId)
      setErrorMessage(null)
      await deleteAdminWhiteboardInstance(instanceId)
      setInstances((prev) => prev.filter((item) => item.instanceId !== instanceId))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('admin.instancesDeleteError'))
    } finally {
      setDeletingId(null)
      setPendingDeleteId(null)
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
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(event) => setIncludeExpired(event.target.checked)}
              className="accent-emerald-300"
            />
            {t('admin.includeExpired')}
          </label>
          <button type="button" onClick={() => void loadInstances()} className="btn-outline h-10 rounded-xl px-4">
            {t('admin.reloadInstances')}
          </button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        {errorMessage && (
          <p className="rounded-xl bg-rose-950/45 px-4 py-3 text-sm text-rose-200">{errorMessage}</p>
        )}

        <div className="scrollbar-tactical min-h-0 flex-1 overflow-auto rounded-xl border border-emerald-200/20">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-emerald-900/95 text-emerald-100 backdrop-blur">
              <tr>
                <th className="px-4 py-3">{t('admin.instanceId')}</th>
                <th className="px-4 py-3">{t('admin.mapId')}</th>
                <th className="px-4 py-3">{t('admin.status')}</th>
                <th className="px-4 py-3">{t('admin.hasState')}</th>
                <th className="px-4 py-3">{t('admin.createdAt')}</th>
                <th className="px-4 py-3">{t('admin.updatedAt')}</th>
                <th className="px-4 py-3">{t('admin.expireAt')}</th>
                <th className="px-4 py-3">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-emerald-50/70">
                    {t('common.loading')}
                  </td>
                </tr>
              )}

              {!loading && instances.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-emerald-50/70">
                    {t('admin.instancesEmpty')}
                  </td>
                </tr>
              )}

              {!loading &&
                instances.map((item) => (
                  <tr key={item.instanceId} className="border-t border-emerald-200/15">
                    <td className="px-4 py-3 text-emerald-50/90">{item.instanceId}</td>
                    <td className="px-4 py-3 text-white">{item.mapId}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.active
                            ? 'rounded-full border border-emerald-300/45 bg-emerald-300/15 px-2 py-1 text-xs text-emerald-100'
                            : 'rounded-full border border-rose-300/45 bg-rose-300/15 px-2 py-1 text-xs text-rose-100'
                        }
                      >
                        {item.active ? t('admin.active') : t('admin.expired')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-emerald-50/85">{item.hasState ? t('admin.yes') : t('admin.no')}</td>
                    <td className="px-4 py-3 text-emerald-50/85">{item.createdAt || '-'}</td>
                    <td className="px-4 py-3 text-emerald-50/85">{item.updatedAt || '-'}</td>
                    <td className="px-4 py-3 text-emerald-50/85">{item.expireAt || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(item.instanceId)}
                        disabled={deletingId === item.instanceId}
                        className="h-9 rounded-lg border border-rose-300/45 px-3 text-xs font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {deletingId === item.instanceId ? t('common.loading') : t('admin.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-200/25 bg-[#1b1313] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">{t('admin.confirmDeleteInstanceTitle')}</h2>
            <p className="mt-2 text-sm text-rose-100/80">
              {t('admin.confirmDeleteInstanceDesc', { instanceId: pendingDeleteId })}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="btn-outline h-10 rounded-xl px-4"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(pendingDeleteId)}
                disabled={deletingId === pendingDeleteId}
                className="h-10 rounded-xl border border-rose-300/45 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {deletingId === pendingDeleteId ? t('common.loading') : t('admin.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
