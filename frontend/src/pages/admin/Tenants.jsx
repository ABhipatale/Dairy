import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Plus } from 'lucide-react'
import { useApi, useDebounce } from '../../hooks/useApi'
import { TenantFormModal } from '../../components/TenantFormModal'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Segmented } from '../../components/ui'
import { fmtDate, int } from '../../utils/format'

export default function Tenants() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounce(search)

  useEffect(() => setPage(1), [term, status])
  const { data, error, loading, refetch } = useApi('/admin/tenants', { search: term || undefined, status: status || undefined, page })

  const columns = [
    { key: 'name', header: t('settings.company_fields.name'), mobile: 'title', render: (tn) => <span className="font-semibold text-slate-900">{tn.name}</span> },
    { key: 'owner_name', header: t('settings.company_fields.owner_name'), mobile: 'subtitle' },
    { key: 'city', header: t('settings.company_fields.city'), mobile: 'subtitle' },
    { key: 'customers_count', header: t('admin.total_customers'), align: 'right', render: (tn) => int(tn.customers_count) },
    { key: 'subscription_ends_at', header: t('admin.subscription_ends_at'), render: (tn) => (tn.subscription_ends_at ? fmtDate(tn.subscription_ends_at) : '–') },
    { key: 'status', header: t('common.status'), mobile: 'value', render: (tn) => <Badge tone={tn.status === 'active' ? 'green' : tn.status === 'suspended' ? 'amber' : 'red'} dot>{t(`admin.status_${tn.status}`)}</Badge> },
  ]

  return (
    <div>
      <PageHeader title={t('admin.companies')} actions={<Button icon={Plus} onClick={() => setParams({ new: '1' })}>{t('admin.add_company')}</Button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} className="flex-1" />
          <Segmented value={status} onChange={setStatus} options={[
            { value: '', label: t('common.all') },
            { value: 'active', label: t('admin.status_active') },
            { value: 'inactive', label: t('admin.status_inactive') },
            { value: 'suspended', label: t('admin.status_suspended') },
          ]} />
        </div>
        {error ? <ErrorState error={error} onRetry={refetch} /> : (
          <DataTable columns={columns} rows={data?.data} loading={loading} onRowClick={(tn) => navigate(`/admin/tenants/${tn.id}`)} empty={<EmptyState icon={Building2} title={t('common.no_results')} />} />
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
      <TenantFormModal open={params.get('new') === '1'} onClose={() => setParams({})} onSaved={(tn) => navigate(`/admin/tenants/${tn.id}`)} />
    </div>
  )
}
