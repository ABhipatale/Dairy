import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Sparkles } from 'lucide-react'

/** Asks before activating a new service worker so an entry in progress is never interrupted. */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for new versions hourly on long-running tablets.
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="flex items-center gap-2 bg-brand-600 px-4 py-2 text-sm text-white">
      <Sparkles className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{t('offline.update_available')}</span>
      <button type="button" className="rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25" onClick={() => updateServiceWorker(true)}>
        {t('offline.update')}
      </button>
    </div>
  )
}
