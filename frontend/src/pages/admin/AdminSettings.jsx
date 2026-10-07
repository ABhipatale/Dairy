import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { SettingsCard } from '../../components/SettingsForm'
import { ErrorState, Field, Input, PageHeader, Spinner } from '../../components/ui'

export default function AdminSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data, error, loading, refetch, setData } = useApi('/admin/settings')

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading && !data) return <Spinner />

  const save = async (values) => {
    try {
      const { data: res } = await api.put('/admin/settings', values)
      setData(res)
      toast.success(t('settings.saved'))
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('admin.global_settings')} />
      <SettingsCard title={t('admin.global_settings')} values={data.data} onSave={save}>
        {(d, set) => (
          <div className="space-y-4 py-3">
            <Field label={t('admin.app_name')}>{({ id }) => <Input id={id} value={d.app_name || ''} onChange={(e) => set('app_name', e.target.value)} />}</Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('admin.support_mobile')}>{({ id }) => <Input id={id} value={d.support_mobile || ''} onChange={(e) => set('support_mobile', e.target.value)} />}</Field>
              <Field label={t('admin.support_email')}>{({ id }) => <Input id={id} type="email" value={d.support_email || ''} onChange={(e) => set('support_email', e.target.value)} />}</Field>
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
