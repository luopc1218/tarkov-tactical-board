import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface AdminLoginPageProps {
  onLogin: (payload: { username: string; password: string }) => Promise<void>
  loading: boolean
  errorMessage: string | null
}

export function AdminLoginPage({ onLogin, loading, errorMessage }: AdminLoginPageProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onLogin({ username, password })
  }

  return (
    <main className="app-page grid place-items-center px-4 py-8 md:py-12">
      <section className="panel relative w-full max-w-4xl overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-300/10 via-transparent to-transparent" />
        <div className="grid md:grid-cols-[1.05fr_1fr]">
          <aside className="border-b border-emerald-300/15 bg-emerald-900/20 p-6 md:border-b-0 md:border-r md:p-8">
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300/95">{t('admin.portal')}</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white md:text-4xl">
              {t('admin.loginTitle')}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-emerald-50/75">{t('admin.loginSubtitle')}</p>
            <div className="mt-8 hidden h-px w-full bg-emerald-200/15 md:block" />
          </aside>

          <div className="p-6 md:p-8">
            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium tracking-wide text-emerald-50/75">
                  {t('admin.account')}
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t('admin.account')}
                  className="w-full rounded-xl border border-emerald-200/20 bg-black/25 px-3.5 py-2.5 text-sm text-white placeholder:text-emerald-50/40 outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium tracking-wide text-emerald-50/75">
                  {t('admin.password')}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('admin.password')}
                  className="w-full rounded-xl border border-emerald-200/20 bg-black/25 px-3.5 py-2.5 text-sm text-white placeholder:text-emerald-50/40 outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
                />
              </label>

              {errorMessage && <p className="rounded-lg bg-rose-950/45 px-3 py-2 text-sm text-rose-200">{errorMessage}</p>}

              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="btn-primary mt-1 w-full py-2.5 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? t('common.loading') : t('admin.login')}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
