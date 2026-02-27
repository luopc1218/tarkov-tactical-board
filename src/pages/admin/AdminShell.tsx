import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '../../router/routes'

type AdminNavKey = 'dashboard' | 'maps' | 'instances' | 'password'

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
    'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition duration-200',
    active
      ? 'bg-slate-100/95 text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.25)]'
      : 'text-slate-300 hover:bg-slate-700/35 hover:text-white',
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
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-400">ADMIN</p>
          <p className="mt-1 text-sm text-slate-300">Tarkov Map Board</p>
        </div>
        <div className="h-9" />
      </div>

      <div className="flex min-h-0 w-full flex-1 gap-6">
        <aside className="ios-card flex w-64 shrink-0 flex-col overflow-hidden p-4">
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
            <button
              type="button"
              onClick={() => onNavigate(ROUTES.adminInstances)}
              className={navStyle(current === 'instances')}
            >
              {t('admin.instanceManagement')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ROUTES.adminPassword)}
              className={navStyle(current === 'password')}
            >
              {t('admin.changePassword')}
            </button>
          </nav>

          <button
            type="button"
            onClick={onLogout}
            className="btn-outline mt-auto inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold"
          >
            {t('admin.logout')}
          </button>
        </aside>

        <section className="min-w-0 min-h-0 flex-1">
          <motion.div
            key={current}
            className="flex h-full min-h-0 flex-col gap-4"
            initial={{ opacity: 0, x: 18, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="ios-card shrink-0 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold tracking-[-0.02em] text-slate-100">
                    {title}
                  </h1>
                  <p className="mt-1 text-sm text-slate-300/85">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2">{headerActions}</div>
              </div>
            </header>

            <div className="ios-card min-h-0 flex-1 overflow-hidden p-5">{children}</div>
          </motion.div>
        </section>
      </div>
    </main>
  )
}
