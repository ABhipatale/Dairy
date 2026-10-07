import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { cn } from '../utils/cn'

/** English · मराठी · हिंदी — saved locally and on the user's profile. */
export function LanguageSwitcher({ compact = false, className }) {
  const { i18n } = useTranslation()
  const { session, isAuthenticated, updateSession } = useAuth() || {}

  const languages = session?.languages?.length
    ? SUPPORTED_LANGUAGES.filter((l) => session.languages.some((s) => s.code === l.code))
    : SUPPORTED_LANGUAGES

  const choose = (code) => {
    setLanguage(code)
    if (isAuthenticated) {
      api.put('/auth/profile', { language: code }).catch(() => {})
      updateSession?.({ user: { ...session.user, language: code } })
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {!compact && <Languages className="size-4 text-slate-400" aria-hidden />}
      <div className="flex flex-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Language">
        {languages.map((l) => (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={i18n.language === l.code}
            onClick={() => choose(l.code)}
            className={cn(
              'flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
              i18n.language === l.code ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {l.native}
          </button>
        ))}
      </div>
    </div>
  )
}
