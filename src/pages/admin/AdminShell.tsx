import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { ROUTES } from '../../router/routes'

type AdminNavKey = 'dashboard' | 'maps'

interface AdminShellProps {
  current: AdminNavKey
  title: string
  subtitle: string
  onNavigate: (path: string) => void
  onLogout: () => void
  children: ReactNode
  headerActions?: ReactNode
}

const navStyle = (active: boolean) =>
  [
    'w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
    active
      ? 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/35'
      : 'text-emerald-50/80 hover:bg-emerald-400/10 hover:text-emerald-50',
  ].join(' ')

export function AdminShell({
  current,
  title,
  subtitle,
  onNavigate,
  onLogout,
  children,
  headerActions,
}: AdminShellProps) {
  const { t } = useTranslation()

  return (
    <main className="app-page flex h-screen min-w-[1200px] flex-col overflow-hidden px-6 pb-6 pt-6">
      <div className="mb-4 flex w-full shrink-0 items-center justify-between">
        <div className="w-64 pl-1">
          <p className="text-xs font-semibold tracking-[0.14em] text-emerald-300">ADMIN</p>
          <p className="mt-1 text-sm text-emerald-50/70">Tarkov Tactical Board</p>
        </div>
        <LanguageSwitcher inline />
      </div>

      <div className="flex min-h-0 w-full flex-1 gap-6">
        <aside className="panel flex w-64 shrink-0 flex-col overflow-hidden p-4">
          <nav className="space-y-2">
            <button
              type="button"
              onClick={() => onNavigate(ROUTES.adminDashboard)}
              className={navStyle(current === 'dashboard')}
            >
              {t('admin.dashboardTitle')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ROUTES.adminMaps)}
              className={navStyle(current === 'maps')}
            >
              {t('admin.mapManagement')}
            </button>
          </nav>

          <button
            type="button"
            onClick={onLogout}
            className="mt-auto inline-flex h-10 items-center rounded-full border border-rose-300/45 px-5 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15"
          >
            {t('admin.logout')}
          </button>
        </aside>

        <section className="min-w-0 flex min-h-0 flex-1 flex-col gap-4">
          <header className="panel shrink-0 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white">{title}</h1>
                <p className="mt-1 text-sm text-emerald-50/70">{subtitle}</p>
              </div>
              <div className="flex items-center gap-2">{headerActions}</div>
            </div>
          </header>

          <div className="panel min-h-0 flex-1 overflow-hidden p-5">{children}</div>
        </section>
      </div>
    </main>
  )
}
