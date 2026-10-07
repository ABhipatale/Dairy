import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Users } from 'lucide-react'
import { useApi, useDebounce } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Segmented, Select } from '../../components/ui'
import { money } from '../../utils/format'

export default function CustomerList() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [village, setVillage] = useState('')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(1)
  const term = useDebounce(search)

  useEffect(() => setPage(1), [term, status, village, sort])

  const { data: villages } = useApi('/customers/villages')
  const { data, error, loading, refetch } = useApi('/customers', {
    search: term || undefined,
    status: status || undefined,
    village: village || undefined,
    sort: sort === 'recent' ? 'created_at' : sort,
    dir: sort === 'recent' ? 'desc' : 'asc',
    page,
  })

  const columns = [
    { key: 'code', header: t('customers.code'), mobile: 'hide', render: (c) => <span className="tabular font-semibold text-slate-700">{c.code}</span>, className: 'w-20' },
    {
      key: 'name', header: t('common.name'), mobile: 'title',
      render: (c) => (
        <span className="font-semibold text-slate-900">
          <span className="mr-1.5 text-slate-400 md:hidden">#{c.code}</span>{c.name}
        </span>
      ),
    },
    { key: 'mobile', header: t('common.mobile'), mobile: 'subtitle', render: (c) => c.mobile || '–' },
    { key: 'village', header: t('customers.village'), mobile: 'subtitle', render: (c) => c.village || '–' },
    {
      key: 'status', header: t('common.status'), mobile: 'value',
      render: (c) => <Badge tone={c.status === 'active' ? 'green' : 'gray'} dot>{t(`common.${c.status}`)}</Badge>,
    },
    { key: 'opening_balance', header: t('customers.opening_balance'), align: 'right', mobile: 'hide', render: (c) => money(c.opening_balance) },
  ]

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        subtitle={data?.meta ? `${data.meta.total} ${t('common.customers')}` : null}
        actions={can('customers.manage') && (
          <Link to="/customers/new"><Button icon={Plus}>{t('customers.add')}</Button></Link>
        )}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder={t('customers.search_placeholder')} className="flex-1" />
          <div className="flex flex-wrap gap-2">
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: t('common.active') },
                { value: 'inactive', label: t('common.inactive') },
                { value: '', label: t('common.all') },
              ]}
            />
            {villages?.data?.length > 0 && (
              <Select value={village} onChange={(e) => setVillage(e.target.value)} size="sm" className="min-w-36">
                <option value="">{t('customers.village_filter')}</option>
                {villages.data.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            )}
            <Select value={sort} onChange={(e) => setSort(e.target.value)} size="sm" aria-label={t('common.sort')}>
              <option value="name">{t('customers.sort_name')}</option>
              <option value="code">{t('customers.sort_code')}</option>
              <option value="recent">{t('customers.sort_recent')}</option>
            </Select>
          </div>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            loading={loading}
            onRowClick={(c) => navigate(`/customers/${c.id}`)}
            empty={
              term || village ? (
                <EmptyState icon={Users} title={t('customers.no_match')} />
              ) : (
                <EmptyState
                  icon={Users}
                  title={t('customers.empty_title')}
                  text={t('customers.empty_text')}
                  action={can('customers.manage') && <Link to="/customers/new"><Button icon={Plus}>{t('customers.add')}</Button></Link>}
                />
              )
            }
          />
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
    </div>
  )
}
