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
        'lang-switcher bg-transparent p-0',
        inline ? 'relative z-10' : 'lang-switcher-floating fixed z-30',
      ].join(' ')}
    >
      <div className="ios-segment w-[5.8rem]" role="tablist" aria-label="Language">
        <button
          type="button"
          role="tab"
          aria-selected={current === 'zh'}
          onClick={() => changeLanguage('zh')}
          className={['ios-segment-button', current === 'zh' ? 'is-active' : ''].join(' ')}
        >
          中
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={current === 'en'}
          onClick={() => changeLanguage('en')}
          className={['ios-segment-button', current === 'en' ? 'is-active' : ''].join(' ')}
        >
          EN
        </button>
      </div>
    </div>
  )
}
