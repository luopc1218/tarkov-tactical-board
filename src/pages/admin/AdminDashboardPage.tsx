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
        <button type="button" onClick={() => onNavigate(ROUTES.adminMaps)} className="btn-outline h-10 rounded-xl px-4">
          {t('admin.mapManagement')}
        </button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-emerald-200/15 bg-black/20 p-5">
          <p className="text-xs text-emerald-100/70">{t('admin.mapManagement')}</p>
          <p className="mt-2 text-2xl font-semibold text-white">API Connected</p>
        </section>
        <section className="rounded-xl border border-emerald-200/15 bg-black/20 p-5">
          <p className="text-xs text-emerald-100/70">Status</p>
          <p className="mt-2 text-2xl font-semibold text-white">Online</p>
        </section>
      </div>
    </AdminShell>
  )
}
