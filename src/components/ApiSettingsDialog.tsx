import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'
import { getApiBaseUrl, getDefaultApiBaseUrl, setApiBaseUrl } from '../lib/runtime-config'

interface ApiSettingsDialogProps {
  onClose: () => void
}

const isValidApiBaseUrl = (value: string) => {
  if (value.startsWith('/')) {
    return true
  }

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function ApiSettingsDialog({ onClose }: ApiSettingsDialogProps) {
  const { t } = useTranslation()
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(() => getApiBaseUrl())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSave = () => {
    const value = apiBaseUrlInput.trim()
    if (!value || !isValidApiBaseUrl(value)) {
      setErrorMessage(t('settings.apiBaseUrlInvalid'))
      return
    }

    setApiBaseUrl(value)
    onClose()
  }

  const handleReset = () => {
    setApiBaseUrl('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-emerald-200/30 bg-[linear-gradient(165deg,rgba(8,19,15,0.95)_0%,rgba(16,33,26,0.92)_100%)] p-5 text-emerald-50 shadow-[0_24px_60px_rgba(0,0,0,0.45)] md:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">{t('settings.title')}</h2>
            <p className="mt-1 text-sm text-emerald-100/75">{t('settings.description')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-emerald-200/30 px-3 py-1.5 text-sm text-emerald-100/90 transition hover:bg-emerald-100/10"
          >
            {t('common.cancel')}
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200/20 bg-black/20 px-3 py-2">
          <span className="text-sm font-semibold text-emerald-100/90">{t('common.language')}</span>
          <LanguageSwitcher inline />
        </div>

        <label className="block text-sm font-semibold text-emerald-100/90">{t('settings.apiBaseUrlLabel')}</label>
        <input
          type="text"
          value={apiBaseUrlInput}
          onChange={(event) => setApiBaseUrlInput(event.target.value)}
          placeholder={getDefaultApiBaseUrl()}
          className="mt-2 h-11 w-full rounded-xl border border-emerald-200/30 bg-black/25 px-3 text-sm text-emerald-50 outline-none focus:border-emerald-200/60"
        />

        <p className="mt-2 text-xs text-emerald-100/65">{t('settings.apiBaseUrlHint')}</p>
        {errorMessage && (
          <p className="mt-3 rounded-lg border border-rose-300/35 bg-rose-950/35 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-emerald-200/30 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-100/10"
          >
            {t('settings.reset')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl border border-cyan-200/35 bg-[linear-gradient(135deg,#2f7b56_0%,#1f9d79_55%,#13b6a1_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
