import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileText, Layers, Plus } from 'lucide-react'
import api from '../../services/api'
import { useApi, useDebounce } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  BillStatusBadge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Segmented,
} from '../../components/ui'
import { billingPeriod, addDays, isoDate, money, periodLabel, qty } from '../../utils/format'

export default function BillList() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [bulk, setBulk] = useState(false)
  const term = useDebounce(search)

  useEffect(() => setPage(1), [term, status])

  const { data, error, loading, refetch } = useApi('/bills', { status: status || undefined, search: term || undefined, page })

  // The period that just ended is the one normally billed.
  const current = billingPeriod(isoDate())
  const lastPeriod = billingPeriod(addDays(current.start, -1))

  const runBulk = async () => {
    try {
      const { data: res } = await api.post('/bills/bulk-generate', { period_start: lastPeriod.start }, { timeout: 120000 })
      toast.success(`${t('billing.bulk_done', { count: res.created })}${res.skipped.length ? ` · ${t('billing.bulk_skipped', { count: res.skipped.length })}` : ''}`)
      refetch()
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }

  const columns = [
    { key: 'bill_no', header: t('billing.bill_no'), mobile: 'subtitle', render: (b) => <span className="font-mono text-xs font-semibold text-slate-600">{b.bill_no}</span> },
    {
      key: 'customer', header: t('common.customer'), mobile: 'title',
      render: (b) => <span className="font-semibold text-slate-900">{b.customer?.name} <span className="font-normal text-slate-400">#{b.customer?.code}</span></span>,
    },
    { key: 'period', header: t('billing.period'), mobile: 'subtitle', render: (b) => periodLabel({ start: b.period_start, end: b.period_end }) },
    { key: 'status', header: t('common.status'), mobile: 'subtitle', render: (b) => <BillStatusBadge status={b.status} /> },
    { key: 'total_qty', header: t('billing.total_milk'), align: 'right', render: (b) => `${qty(b.total_qty)} ${t('common.litre')}` },
    { key: 'net_payable', header: t('billing.net_payable'), align: 'right', render: (b) => money(b.net_payable) },
    {
      key: 'outstanding', header: t('billing.outstanding'), align: 'right', mobile: 'value',
      render: (b) => <span className={parseFloat(b.outstanding) > 0 && !b.carried_forward_to_id ? 'font-semibold text-amber-700' : 'text-slate-500'}>{money(b.outstanding)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('billing.title')}
        actions={can('bills.manage') && (
          <>
            <Button variant="secondary" icon={Layers} onClick={() => setBulk(true)}>{t('billing.bulk_generate')}</Button>
            <Link to="/bills/new"><Button icon={Plus}>{t('billing.generate')}</Button></Link>
          </>
        )}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder={`${t('billing.bill_no')}, ${t('customers.search_placeholder').toLowerCase()}`} className="flex-1" />
          <Segmented
            value={status}
            onChange={(v) => setParams(v ? { status: v } : {})}
            className="overflow-x-auto"
            options={[
              { value: '', label: t('billing.tabs_all') },
              { value: 'open', label: t('billing.tabs_open') },
              { value: 'paid', label: t('billing.tabs_paid') },
              { value: 'cancelled', label: t('billing.tabs_cancelled') },
            ]}
          />
        </div>

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            loading={loading}
            onRowClick={(b) => navigate(`/bills/${b.id}`)}
            empty={
              <EmptyState
                icon={FileText}
                title={t('billing.empty_title')}
                text={t('billing.empty_text')}
                action={can('bills.manage') && <Link to="/bills/new"><Button icon={Plus}>{t('billing.generate')}</Button></Link>}
              />
            }
          />
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>

      <ConfirmDialog
        open={bulk}
        onClose={() => setBulk(false)}
        onConfirm={runBulk}
        tone="primary"
        title={t('billing.bulk_generate')}
        message={t('billing.bulk_confirm', { period: periodLabel(lastPeriod) })}
        confirmLabel={t('billing.generate')}
      />
    </div>
  )
}
