import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources, type SupportedLanguage } from './resources'

const LANGUAGE_STORAGE_KEY = 'tarkov_tactical_board_lang'
const defaultLanguage: SupportedLanguage = 'zh'

const detectInitialLanguage = (): SupportedLanguage => {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'zh' || stored === 'en') {
    return stored
  }

  const browser = navigator.language.toLowerCase()
  return browser.startsWith('zh') ? 'zh' : 'en'
}

const initialLanguage = detectInitialLanguage()

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: defaultLanguage,
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', (lng) => {
  if (lng === 'zh' || lng === 'en') {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  }
})

export default i18n
