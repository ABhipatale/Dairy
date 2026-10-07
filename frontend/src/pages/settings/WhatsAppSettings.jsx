import { useTranslation } from 'react-i18next'
import { MessageSquareText } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import { SettingsCard } from '../../components/SettingsForm'
import { ErrorState, PageHeader, Spinner, Toggle } from '../../components/ui'

/** WhatsApp opens on this phone with the message ready — the user just taps Send. No setup needed. */
export default function WhatsAppSettings() {
  const { t } = useTranslation()
  const { data, error, saving, save } = useSettings()

  if (error) return <ErrorState error={error} />
  if (!data) return <Spinner />

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('settings.whatsapp')} back="/settings" />

      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
        <MessageSquareText className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <p>{t('settings.whatsapp_fields.how_it_works')}</p>
      </div>

      <SettingsCard title={t('settings.whatsapp')} values={data.settings.whatsapp} saving={saving === 'whatsapp'} onSave={(v) => save('whatsapp', v)}>
        {(d, set) => (
          <div className="divide-y divide-line">
            <Toggle label={t('settings.whatsapp_fields.enabled')} checked={d.enabled} onChange={(v) => set('enabled', v)} />
            <Toggle
              label={t('settings.whatsapp_fields.auto_send')}
              description={t('settings.whatsapp_fields.auto_send_hint')}
              checked={d.auto_send}
              disabled={!d.enabled}
              onChange={(v) => set('auto_send', v)}
            />
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
