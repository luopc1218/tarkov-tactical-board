import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { changeAdminPassword } from '../../api/admin-auth'
import { AdminShell } from './AdminShell'

interface AdminPasswordPageProps {
  onNavigate: (path: string) => void
  onLogout: () => void
}

export function AdminPasswordPage({ onNavigate, onLogout }: AdminPasswordPageProps) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const passwordStrength = useMemo(() => {
    const candidate = newPassword.trim()
    if (!candidate) {
      return { score: 0, label: t('admin.passwordStrengthWeak') }
    }

    let score = 0
    if (candidate.length >= 8) score += 1
    if (/[A-Z]/.test(candidate) && /[a-z]/.test(candidate)) score += 1
    if (/\d/.test(candidate)) score += 1
    if (/[^A-Za-z0-9]/.test(candidate)) score += 1

    if (score <= 1) {
      return { score, label: t('admin.passwordStrengthWeak') }
    }
    if (score <= 3) {
      return { score, label: t('admin.passwordStrengthMedium') }
    }
    return { score, label: t('admin.passwordStrengthStrong') }
  }, [newPassword, t])

  const ruleStatus = useMemo(
    () => ({
      length: newPassword.length >= 8,
      diff: Boolean(currentPassword) && Boolean(newPassword) && currentPassword !== newPassword,
      match: Boolean(confirmPassword) && newPassword === confirmPassword,
    }),
    [confirmPassword, currentPassword, newPassword]
  )

  const validationError = useMemo(() => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      return t('admin.passwordRequired')
    }
    if (newPassword.length < 8) {
      return t('admin.passwordMinLength')
    }
    if (newPassword === currentPassword) {
      return t('admin.passwordNoChange')
    }
    if (newPassword !== confirmPassword) {
      return t('admin.passwordMismatch')
    }
    return null
  }, [confirmPassword, currentPassword, newPassword, t])

  const handleSubmit = async () => {
    setValidationMessage(null)
    setSuccessMessage(null)

    if (validationError) {
      setValidationMessage(validationError)
      return
    }

    try {
      setSaving(true)
      const result = await changeAdminPassword({
        oldPassword: currentPassword,
        newPassword,
      })
      setSuccessMessage(result.message || t('admin.passwordSubmitSuccess'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.warn('[AdminPasswordPage] Change password failed', error)
      setValidationMessage(t('admin.passwordSubmitError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      current="password"
      title={t('admin.passwordTitle')}
      subtitle={t('admin.passwordSubtitle')}
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <div className="scrollbar-tactical h-full min-h-0 overflow-auto pr-1">
        <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[1.2fr,1fr]">
          <section className="rounded-2xl border border-slate-600/70 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold text-white">{t('admin.changePassword')}</h2>
            <p className="mt-1 text-sm text-slate-300">{t('admin.passwordFormHint')}</p>

            <div className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">
                  {t('admin.currentPassword')}
                </span>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 pr-16 text-sm text-white placeholder:text-slate-500 outline-none ring-0 transition focus:border-amber-400"
                    placeholder={t('admin.currentPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700/40 hover:text-slate-100"
                  >
                    {showCurrentPassword ? t('admin.hidePassword') : t('admin.showPassword')}
                  </button>
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">{t('admin.newPassword')}</span>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 pr-16 text-sm text-white placeholder:text-slate-500 outline-none ring-0 transition focus:border-amber-400"
                    placeholder={t('admin.newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700/40 hover:text-slate-100"
                  >
                    {showNewPassword ? t('admin.hidePassword') : t('admin.showPassword')}
                  </button>
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">
                  {t('admin.confirmPassword')}
                </span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2.5 pr-16 text-sm text-white placeholder:text-slate-500 outline-none ring-0 transition focus:border-amber-400"
                    placeholder={t('admin.confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-700/40 hover:text-slate-100"
                  >
                    {showConfirmPassword ? t('admin.hidePassword') : t('admin.showPassword')}
                  </button>
                </div>
              </label>

              <div className="rounded-xl border border-slate-600 bg-slate-800/70 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                  <span>{t('admin.passwordStrength')}</span>
                  <span>{passwordStrength.label}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-950/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 transition-all duration-300"
                    style={{ width: `${Math.max(8, (passwordStrength.score / 4) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {validationMessage && (
              <p className="mt-4 rounded-xl bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
                {validationMessage}
              </p>
            )}
            {successMessage && (
              <p className="mt-4 rounded-xl bg-amber-500/20 px-4 py-3 text-sm text-amber-100">
                {successMessage}
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving || Boolean(validationError)}
                className="btn-primary h-9 rounded-lg px-4 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? t('common.loading') : t('admin.savePassword')}
              </button>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-600/70 bg-slate-900/60 p-6">
            <h3 className="text-base font-semibold text-slate-100">
              {t('admin.passwordSecurityTitle')}
            </h3>
            <p className="mt-1 text-sm text-slate-300">{t('admin.passwordSecurityDesc')}</p>

            <ul className="mt-5 space-y-2 text-sm">
              <li
                className={[
                  'rounded-lg border px-3 py-2',
                  ruleStatus.length
                    ? 'border-amber-300/35 bg-amber-500/10 text-amber-100'
                    : 'border-slate-600 bg-slate-800/70 text-slate-300',
                ].join(' ')}
              >
                {t('admin.passwordRuleLength')}
              </li>
              <li
                className={[
                  'rounded-lg border px-3 py-2',
                  ruleStatus.diff
                    ? 'border-amber-300/35 bg-amber-500/10 text-amber-100'
                    : 'border-slate-600 bg-slate-800/70 text-slate-300',
                ].join(' ')}
              >
                {t('admin.passwordRuleDiff')}
              </li>
              <li
                className={[
                  'rounded-lg border px-3 py-2',
                  ruleStatus.match
                    ? 'border-amber-300/35 bg-amber-500/10 text-amber-100'
                    : 'border-slate-600 bg-slate-800/70 text-slate-300',
                ].join(' ')}
              >
                {t('admin.passwordRuleMatch')}
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </AdminShell>
  )
}
