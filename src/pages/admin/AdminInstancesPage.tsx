import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { FiCopy } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
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
      return zh || en || fallback || (item.mapId != null ? String(item.mapId) : '-')
    }
    return en || zh || fallback || (item.mapId != null ? String(item.mapId) : '-')
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
    void loadInstances()
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
        <div className="flex items-center gap-2">
          <div className="ios-segment">
            <button
              type="button"
              onClick={() => {
                setIncludeExpired(false)
                setPage(1)
              }}
              className={['ios-segment-button', includeExpired ? '' : 'is-active'].join(' ')}
            >
              {t('admin.active')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIncludeExpired(true)
                setPage(1)
              }}
              className={['ios-segment-button', includeExpired ? 'is-active' : ''].join(' ')}
            >
              {t('admin.includeExpired')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void loadInstances()}
            className="btn-outline h-9 rounded-lg px-3.5"
          >
            {t('admin.reloadInstances')}
          </button>
          <button
            type="button"
            onClick={() => setPendingClearAll(true)}
            disabled={loading || clearingAll}
            className="h-9 rounded-lg border border-rose-300/45 px-3.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {clearingAll ? t('common.loading') : t('admin.clearAllInstances')}
          </button>
          <label className="ios-input inline-flex h-9 items-center gap-2 px-2.5 text-xs text-slate-200">
            <span className="shrink-0 text-slate-300">{t('admin.pageSize')}</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
              className="h-7 rounded-md bg-transparent px-2 text-xs text-slate-100 outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size} className="bg-slate-900 text-slate-100">
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="scrollbar-tactical min-h-0 flex-1 overflow-auto rounded-xl border border-slate-600/70">
          <table className="w-full min-w-[1280px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-900/98 text-slate-200 backdrop-blur">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">{t('admin.instanceId')}</th>
                <th className="px-4 py-3 whitespace-nowrap">{t('admin.mapName')}</th>
                <th className="px-4 py-3 whitespace-nowrap">{t('admin.status')}</th>
                <th className="px-4 py-3 whitespace-nowrap">{t('admin.hasState')}</th>
                <th className="px-4 py-3 whitespace-nowrap">{t('admin.createdAt')}</th>
                <th className="px-4 py-3 whitespace-nowrap">{t('admin.updatedAt')}</th>
                <th className="px-4 py-3 whitespace-nowrap">{t('admin.expireAt')}</th>
                <th className="px-4 py-3 whitespace-nowrap">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-300">
                    {t('common.loading')}
                  </td>
                </tr>
              )}

              {!loading && instances.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-300">
                    {t('admin.instancesEmpty')}
                  </td>
                </tr>
              )}

              {!loading &&
                instances.map((item) => (
                  <tr key={item.instanceId} className="border-t border-slate-700/70">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="min-w-0 flex-1 truncate text-slate-100"
                          title={item.instanceId}
                        >
                          {item.instanceId}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyInstanceId(item.instanceId)}
                          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-500/80 bg-slate-800/70 px-2 text-[11px] font-medium text-slate-200 transition hover:border-amber-300/70 hover:text-white"
                          title={t('admin.copyInstanceId')}
                          aria-label={`${t('admin.copyInstanceId')}: ${item.instanceId}`}
                        >
                          <FiCopy className="text-[0.78rem]" />
                          <span>
                            {copiedInstanceId === item.instanceId
                              ? t('admin.copied')
                              : t('admin.copyInstanceId')}
                          </span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white">
                      <span className="block truncate" title={resolveMapName(item)}>
                        {resolveMapName(item)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.active
                            ? 'rounded-full border border-slate-400/45 bg-slate-500/15 px-2 py-1 text-xs text-slate-100'
                            : 'rounded-full border border-rose-300/45 bg-rose-300/15 px-2 py-1 text-xs text-rose-100'
                        }
                      >
                        {item.active ? t('admin.active') : t('admin.expired')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {item.hasState ? t('admin.yes') : t('admin.no')}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{formatDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDateTime(item.updatedAt)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDateTime(item.expireAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(item.instanceId)}
                        disabled={deletingId === item.instanceId || clearingAll}
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

        <div className="flex items-center justify-between gap-3 text-xs text-slate-300 md:text-sm">
          <span>{t('admin.instancesTotal', { total })}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={loading || page <= 1}
              className="btn-outline h-8 rounded-lg px-3 text-xs disabled:cursor-not-allowed disabled:opacity-55"
            >
              {t('admin.prevPage')}
            </button>
            <span className="min-w-28 text-center">
              {t('admin.pageInfo', { page, pages: Math.max(1, totalPages) })}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={loading || page >= totalPages}
              className="btn-outline h-8 rounded-lg px-3 text-xs disabled:cursor-not-allowed disabled:opacity-55"
            >
              {t('admin.nextPage')}
            </button>
          </div>
        </div>
      </div>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
            <h2 className="text-xl font-semibold text-white">
              {t('admin.confirmDeleteInstanceTitle')}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {t('admin.confirmDeleteInstanceDesc', { instanceId: pendingDeleteId })}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="btn-outline h-9 rounded-lg px-3.5"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(pendingDeleteId)}
                disabled={deletingId === pendingDeleteId}
                className="h-9 rounded-lg border border-rose-300/45 px-3.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {deletingId === pendingDeleteId ? t('common.loading') : t('admin.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingClearAll && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
            <h2 className="text-xl font-semibold text-white">
              {t('admin.confirmClearInstancesTitle')}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{t('admin.confirmClearInstancesDesc')}</p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingClearAll(false)}
                className="btn-outline h-9 rounded-lg px-3.5"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleClearAll()}
                disabled={clearingAll}
                className="h-9 rounded-lg border border-rose-300/45 px-3.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {clearingAll ? t('common.loading') : t('admin.clearAllInstances')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
