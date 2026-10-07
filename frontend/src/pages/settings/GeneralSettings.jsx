import { useTranslation } from 'react-i18next'
import { useSettings } from '../../hooks/useSettings'
import { SettingsCard } from '../../components/SettingsForm'
import { ErrorState, Field, Input, PageHeader, Select, Spinner, Toggle } from '../../components/ui'

/** Milk entry rules, bill options and receipt language. */
export default function GeneralSettings() {
  const { t } = useTranslation()
  const { data, error, saving, save } = useSettings()

  if (error) return <ErrorState error={error} />
  if (!data) return <Spinner />
  const s = data.settings

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t('settings.general')} back="/settings" />

      <SettingsCard title={t('nav.collection')} subtitle={t('settings.general_desc')} values={s.milk} saving={saving === 'milk'} onSave={(v) => save('milk', v)}>
        {(d, set) => (
          <div className="py-2">
            <div className="divide-y divide-line">
              <Toggle label={t('settings.milk_fields.fat_enabled')} checked={d.fat_enabled} onChange={(v) => set('fat_enabled', v)} />
              <Toggle label={t('settings.milk_fields.fat_required')} checked={d.fat_required} disabled={!d.fat_enabled} onChange={(v) => set('fat_required', v)} />
              <Toggle label={t('settings.milk_fields.allow_rate_override')} checked={d.allow_rate_override} onChange={(v) => set('allow_rate_override', v)} />
            </div>
            <div className="py-3 sm:w-1/2">
              <Field label={t('settings.milk_fields.evening_starts_at')}>
                {({ id }) => <Input id={id} type="time" value={d.evening_starts_at || ''} onChange={(e) => set('evening_starts_at', e.target.value)} />}
              </Field>
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title={t('settings.billing')} subtitle={t('settings.billing_desc')} values={s.billing} saving={saving === 'billing'} onSave={(v) => save('billing', v)}>
        {(d, set) => (
          <div className="py-2">
            <Toggle label={t('settings.billing_fields.show_fat_on_bill')} checked={d.show_fat_on_bill} onChange={(v) => set('show_fat_on_bill', v)} />
          </div>
        )}
      </SettingsCard>

      <SettingsCard title={t('settings.language')} subtitle={t('settings.language_desc')} values={s.general} saving={saving === 'general'} onSave={(v) => save('general', v)}>
        {(d, set) => (
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            <Field label={t('settings.general_fields.receipt_language')}>
              {({ id }) => (
                <Select id={id} value={d.receipt_language || ''} onChange={(e) => set('receipt_language', e.target.value || null)}>
                  <option value="">{t('settings.general_fields.same_as_company')}</option>
                  <option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिंदी</option>
                </Select>
              )}
            </Field>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
