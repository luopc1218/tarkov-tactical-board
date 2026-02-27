import { useTranslation } from 'react-i18next'
import { ROUTES } from '../../router/routes'
import { AdminShell } from './AdminShell'

interface AdminDashboardPageProps {
  onNavigate: (path: string) => void
  onLogout: () => void
}

export function AdminDashboardPage({ onNavigate, onLogout }: AdminDashboardPageProps) {
  const { t } = useTranslation()

  return (
    <AdminShell
      current="dashboard"
      title={t('admin.dashboardTitle')}
      subtitle={t('admin.dashboardSubtitle')}
      onNavigate={onNavigate}
      onLogout={onLogout}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate(ROUTES.adminMaps)}
            className="btn-outline h-9 rounded-lg px-3.5"
          >
            {t('admin.mapManagement')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(ROUTES.adminInstances)}
            className="btn-outline h-9 rounded-lg px-3.5"
          >
            {t('admin.instanceManagement')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(ROUTES.adminPassword)}
            className="btn-outline h-9 rounded-lg px-3.5"
          >
            {t('admin.changePassword')}
          </button>
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-600/60 bg-slate-900/70 p-5">
          <p className="text-xs text-slate-300">{t('admin.mapManagement')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">API Connected</p>
        </section>
        <section className="rounded-xl border border-slate-600/60 bg-slate-900/70 p-5">
          <p className="text-xs text-slate-300">Status</p>
          <p className="mt-2 text-2xl font-semibold text-white">Online</p>
        </section>
      </div>
    </AdminShell>
  )
}
