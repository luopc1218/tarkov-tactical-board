import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '../i18n/resources'

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['zh', 'en']

interface LanguageSwitcherProps {
  inline?: boolean
}

export function LanguageSwitcher({ inline = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()

  const current = SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)
    ? (i18n.language as SupportedLanguage)
    : 'zh'

  const changeLanguage = (lang: SupportedLanguage) => {
    if (lang === current) {
      return
    }
    void i18n.changeLanguage(lang)
  }

  return (
    <div
      className={[
        'lang-switcher rounded-full border border-emerald-300/30 bg-black/40 p-1 backdrop-blur',
        inline ? 'relative z-10' : 'lang-switcher-floating fixed right-4 top-3 z-30',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 rounded-full bg-emerald-200/10 p-0.5">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = current === lang

          return (
            <button
              key={lang}
              type="button"
              onClick={() => changeLanguage(lang)}
              className={[
                'min-w-10 rounded-full px-3 py-1 text-xs font-semibold transition',
                active
                  ? 'bg-tact-accent text-slate-900 shadow'
                  : 'text-emerald-50/85 hover:bg-emerald-200/15',
              ].join(' ')}
            >
              {lang === 'zh' ? '中' : 'EN'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
