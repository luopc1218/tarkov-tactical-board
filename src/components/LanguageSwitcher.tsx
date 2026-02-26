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

  const toggleLanguage = () => {
    changeLanguage(current === 'zh' ? 'en' : 'zh')
  }

  const isEnglish = current === 'en'

  return (
    <div
      className={[
        'lang-switcher rounded-full bg-transparent p-0 backdrop-blur',
        inline ? 'relative z-10' : 'lang-switcher-floating fixed z-30',
      ].join(' ')}
    >
      <button
        type="button"
        role="switch"
        aria-checked={isEnglish}
        aria-label="Switch language"
        onClick={toggleLanguage}
        className="lang-switch-track group relative inline-flex h-9 w-[5.75rem] items-center justify-center rounded-full bg-emerald-950/70 p-1 text-[0.68rem] font-semibold leading-none text-emerald-50/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
      >
        <span
          className={[
            'lang-switch-thumb absolute left-1 top-1 h-7 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-b shadow transition-transform duration-300',
            isEnglish
              ? 'translate-x-full from-amber-300 to-amber-400'
              : 'translate-x-0 from-emerald-300 to-emerald-400',
          ].join(' ')}
          aria-hidden="true"
        />
        <span className="relative z-10 grid h-full w-full grid-cols-2 place-items-center px-0.5">
          <span className={['inline-flex h-full w-full items-center justify-center', isEnglish ? 'text-emerald-50/70' : 'text-slate-900'].join(' ')}>
            中
          </span>
          <span className={['inline-flex h-full w-full items-center justify-center', isEnglish ? 'text-slate-900' : 'text-emerald-50/70'].join(' ')}>
            EN
          </span>
        </span>
      </button>
    </div>
  )
}
