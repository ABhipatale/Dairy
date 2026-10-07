import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { Badge, Button, Card, ErrorState, PageHeader, Spinner, Toggle } from '../../components/ui'

/** Enable/disable languages platform-wide and choose the default. */
export default function AdminLanguages() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data, error, loading, refetch } = useApi('/admin/languages')

  const update = async (lang, patch) => {
    try {
      await api.put(`/admin/languages/${lang.id}`, patch)
      toast.success(t('common.saved'))
      refetch()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading && !data) return <Spinner />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('admin.languages_title')} />
      <Card className="divide-y divide-line">
        {data.data.map((l) => (
          <div key={l.id} className="flex items-center gap-4 px-4 py-2">
            <div className="flex-1">
              <Toggle
                label={<span>{l.native_name} <span className="text-slate-400">· {l.name} ({l.code})</span></span>}
                checked={l.is_active}
                disabled={l.is_default}
                onChange={(v) => update(l, { is_active: v })}
              />
            </div>
            {l.is_default ? <Badge tone="blue">{t('admin.default')}</Badge> : (
              <Button size="sm" variant="ghost" onClick={() => update(l, { is_default: true })}>{t('admin.make_default')}</Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}
