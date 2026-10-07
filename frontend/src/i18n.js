import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './translations/en.json'
import mr from './translations/mr.json'
import hi from './translations/hi.json'
import { storage } from './utils/storage'

/**
 * Languages are plain JSON files in src/translations. To add a language:
 * add <code>.json, register it here and in SUPPORTED_LANGUAGES.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', native: 'English' },
  { code: 'mr', native: 'मराठी' },
  { code: 'hi', native: 'हिंदी' },
]

const initial = storage.get('lang') || 'en'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, mr: { translation: mr }, hi: { translation: hi } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
})

const applyLang = (lng) => {
  document.documentElement.lang = lng
}
applyLang(initial)

export function setLanguage(lng) {
  if (!SUPPORTED_LANGUAGES.some((l) => l.code === lng)) return
  storage.set('lang', lng)
  applyLang(lng)
  i18n.changeLanguage(lng)
}

export default i18n
