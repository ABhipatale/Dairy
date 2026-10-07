import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KeyRound, Pencil, Power, Trash2 } from 'lucide-react'
import api from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { TenantFormModal } from '../../components/TenantFormModal'
import { CompanyLoginModal } from '../../components/CompanyLoginModal'
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, PageHeader, Row, Spinner, StatCard } from '../../components/ui'
import { fmtDate, fmtDateTime, int, money, qty } from '../../utils/format'

export default function TenantDetail() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, error, loading, refetch } = useApi(`/admin/tenants/${id}`)
  const login = useApi(`/admin/tenants/${id}/login`)
  const [edit, setEdit] = useState(false)
  const [loginEdit, setLoginEdit] = useState(false)
  const [del, setDel] = useState(false)

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading && !data) return <Spinner />

  const tn = data.data
  const s = data.stats

  const toggle = async () => {
    try {
      await api.put(`/admin/tenants/${tn.id}`, { status: tn.status === 'active' ? 'inactive' : 'active' })
      toast.success(t('admin.updated'))
      refetch()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/admin/tenants/${tn.id}`)
      toast.success(t('admin.deleted'))
      navigate('/admin/tenants', { replace: true })
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }

  return (
    <div>
      <PageHeader
        back="/admin/tenants"
        title={tn.name}
        subtitle={[tn.city, tn.state].filter(Boolean).join(', ')}
        actions={
          <>
            <Badge tone={tn.status === 'active' ? 'green' : 'red'} dot>{t(`admin.status_${tn.status}`)}</Badge>
            <Button variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>{t('common.edit')}</Button>
            <Button variant={tn.status === 'active' ? 'secondary' : 'success'} icon={Power} onClick={toggle}>
              {tn.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
            </Button>
            <Button variant="danger-ghost" icon={Trash2} onClick={() => setDel(true)}>{t('common.delete')}</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('admin.total_customers')} value={int(tn.customers_count)} />
        <StatCard label={`${t('admin.entries_30d')} · ${t('admin.stats')}`} value={int(s.entries_30d)} sub={`${qty(s.milk_30d)} ${t('common.litre')}`} />
        <StatCard label={t('admin.revenue_30d')} value={money(s.revenue_30d)} />
        <StatCard label={t('admin.bills')} value={int(s.bills)} sub={s.last_entry_at ? `${t('admin.last_entry')}: ${fmtDateTime(s.last_entry_at, i18n.language)}` : null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-4">
          <Row label={t('settings.company_fields.owner_name')} value={tn.owner_name || '–'} />
          <Row label={t('settings.company_fields.mobile')} value={tn.mobile || '–'} />
          <Row label={t('settings.company_fields.email')} value={tn.email || '–'} />
          <Row label={t('settings.company_fields.gst_number')} value={tn.gst_number || '–'} />
          <Row label={t('settings.company_fields.default_language')} value={tn.default_language} />
          <Row label={t('admin.plan')} value={tn.plan || '–'} />
          <Row label={t('admin.subscription_ends_at')} value={tn.subscription_ends_at ? fmtDate(tn.subscription_ends_at) : '–'} />
        </Card>

        <Card className="self-start">
          <CardHeader
            title={t('admin.company_login')}
            subtitle={t('admin.company_login_desc')}
            action={login.data && <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setLoginEdit(true)}>{t('common.change')}</Button>}
          />
          {login.data && (
            <div className="px-4 py-3">
              <Row label={t('common.mobile')} value={login.data.data.mobile} strong />
              <Row label={t('common.email')} value={login.data.data.email || '–'} />
              <Row label={t('settings.users_fields.last_login')} value={login.data.data.last_login_at ? fmtDateTime(login.data.data.last_login_at, i18n.language) : t('settings.users_fields.never')} />
              <Row label={t('common.status')} value={<Badge tone={login.data.data.is_active ? 'green' : 'gray'} dot>{login.data.data.is_active ? t('common.active') : t('common.inactive')}</Badge>} />
            </div>
          )}
        </Card>
      </div>

      <TenantFormModal open={edit} onClose={() => setEdit(false)} tenant={tn} onSaved={refetch} />
      <CompanyLoginModal open={loginEdit} onClose={() => setLoginEdit(false)} tenantId={tn.id} login={login.data?.data} onSaved={login.refetch} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={remove} title={t('common.delete')} message={t('admin.delete_confirm')} confirmLabel={t('common.delete')} />
    </div>
  )
}
