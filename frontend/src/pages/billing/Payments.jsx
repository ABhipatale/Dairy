import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Wallet } from 'lucide-react'
import api from '../../services/api'
import { useApi, useDebounce } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PaymentModal } from '../../components/PaymentModal'
import {
  Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, StatCard,
} from '../../components/ui'
import { addDays, fmtDate, isoDate, money } from '../../utils/format'

export default function Payments() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('')
  const [from, setFrom] = useState(addDays(isoDate(), -30))
  const [to, setTo] = useState(isoDate())
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const term = useDebounce(search)

  useEffect(() => setPage(1), [term, method, from, to])

  const { data, error, loading, refetch } = useApi('/payments', {
    search: term || undefined, method: method || undefined, date_from: from || undefined, date_to: to || undefined, page,
  })

  const remove = async () => {
    try {
      await api.delete(`/payments/${deleting.id}`)
      toast.success(t('payments.deleted'))
      refetch()
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }

  const columns = [
    { key: 'payment_date', header: t('payments.date'), mobile: 'subtitle', render: (p) => fmtDate(p.payment_date) },
    {
      key: 'customer', header: t('common.customer'), mobile: 'title',
      render: (p) => <Link to={`/customers/${p.customer?.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-900 hover:text-brand-700">{p.customer?.name} <span className="font-normal text-slate-400">#{p.customer?.code}</span></Link>,
    },
    { key: 'method', header: t('payments.method'), mobile: 'subtitle', render: (p) => t(`payments.methods.${p.method}`) },
    { key: 'bill', header: t('payments.bill'), render: (p) => (p.bill_id ? <Link to={`/bills/${p.bill_id}`} className="font-mono text-xs text-brand-700 hover:underline">{p.bill_no}</Link> : t('payments.advance')) },
    { key: 'reference', header: t('payments.reference'), mobile: 'hide', render: (p) => p.reference || '–' },
    { key: 'amount', header: t('payments.amount'), align: 'right', mobile: 'value', render: (p) => <span className="font-semibold text-emerald-700">{money(p.amount)}</span> },
    can('payments.manage') && {
      key: 'actions', header: '', mobile: 'hide', className: 'w-10',
      render: (p) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); setDeleting(p) }} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={t('common.delete')}>
          <Trash2 className="size-4" />
        </button>
      ),
    },
  ].filter(Boolean)

  return (
    <div>
      <PageHeader
        title={t('payments.title')}
        actions={can('payments.manage') && <Button icon={Plus} variant="success" onClick={() => setAdding(true)}>{t('payments.add')}</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:w-1/2">
        <StatCard icon={Wallet} tone="green" label={t('payments.total_received')} value={money(data?.summary?.total)} sub={`${data?.summary?.count ?? 0} ${t('common.entries')}`} />
      </div>

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder={t('customers.search_placeholder')} className="sm:col-span-2 lg:col-span-1" />
          <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label={t('payments.method')}>
            <option value="">{t('payments.method')}: {t('common.all')}</option>
            {['cash', 'upi', 'bank_transfer', 'other'].map((m) => <option key={m} value={m}>{t(`payments.methods.${m}`)}</option>)}
          </Select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm" aria-label={t('common.from')} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm" aria-label={t('common.to')} />
        </div>

        {error ? <ErrorState error={error} onRetry={refetch} /> : (
          <DataTable
            columns={columns}
            rows={data?.data}
            loading={loading}
            empty={<EmptyState icon={Wallet} title={t('payments.empty_title')} text={t('payments.empty_text')} />}
          />
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>

      <PaymentModal open={adding} onClose={() => setAdding(false)} onSaved={refetch} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={t('common.delete')}
        message={`${t('payments.delete_confirm')} ${deleting ? money(deleting.amount) : ''}`}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
