import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface AdminLoginPageProps {
  onLogin: (payload: { username: string; password: string }) => Promise<void>
  loading: boolean
}

export function AdminLoginPage({ onLogin, loading }: AdminLoginPageProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onLogin({ username, password })
  }

  return (
    <main className="app-page grid place-items-center px-4 py-8 md:py-12">
      <section className="ios-card relative w-full max-w-4xl overflow-hidden p-0">
        <div className="grid md:grid-cols-[1.05fr_1fr]">
          <aside className="border-b border-slate-600/80 bg-slate-800/45 p-6 md:border-b-0 md:border-r md:p-8">
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-300">
              {t('admin.portal')}
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-slate-100 md:text-4xl">
              {t('admin.loginTitle')}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
              {t('admin.loginSubtitle')}
            </p>
            <div className="mt-8 hidden h-px w-full bg-slate-600 md:block" />
          </aside>

          <div className="p-6 md:p-8">
            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium tracking-wide text-slate-300">
                  {t('admin.account')}
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t('admin.account')}
                  className="ios-input w-full px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium tracking-wide text-slate-300">
                  {t('admin.password')}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('admin.password')}
                  className="ios-input w-full px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="btn-primary mt-1 w-full py-2 disabled:cursor-not-allowed disabled:opacity-55"
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
