import { motion } from 'framer-motion'
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
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="ios-card w-full max-w-xl p-5 text-slate-100 md:p-6"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-slate-50">
              {t('settings.title')}
            </h2>
            <p className="mt-1 text-sm text-slate-300/85">{t('settings.description')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-outline rounded-lg px-3 py-1.5 text-sm"
          >
            {t('common.cancel')}
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-600/70 bg-slate-800/70 px-3 py-2">
          <span className="text-sm font-semibold text-slate-100">{t('common.language')}</span>
          <LanguageSwitcher inline />
        </div>

        <label className="block text-sm font-semibold text-slate-100">
          {t('settings.apiBaseUrlLabel')}
        </label>
        <input
          type="text"
          value={apiBaseUrlInput}
          onChange={(event) => setApiBaseUrlInput(event.target.value)}
          placeholder={getDefaultApiBaseUrl()}
          className="ios-input mt-2 h-11 w-full px-3 text-sm text-slate-100 outline-none"
        />

        <p className="mt-2 text-xs text-slate-400">{t('settings.apiBaseUrlHint')}</p>
        {errorMessage && (
          <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-950/65 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="btn-outline rounded-lg px-3 py-1.5 text-sm"
          >
            {t('settings.reset')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary rounded-lg px-4 py-1.5 text-sm font-semibold"
          >
            {t('settings.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
