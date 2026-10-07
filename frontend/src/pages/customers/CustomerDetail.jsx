import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileText, IndianRupee, MapPin, Milk, Moon, Pencil, Phone, Sun, Trash2, Wallet } from 'lucide-react'
import api from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useOffline } from '../../context/OfflineContext'
import { EntriesList } from '../../components/EntriesList'
import { PaymentModal } from '../../components/PaymentModal'
import {
  Badge, BillStatusBadge, Button, Card, CardHeader, ConfirmDialog, DataTable, EmptyState, ErrorState, Pagination, Row, Segmented, Spinner,
} from '../../components/ui'
import { cn } from '../../utils/cn'
import { fmtDate, money, periodLabel, qty } from '../../utils/format'

export default function CustomerDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const toast = useToast()
  const { reloadCustomers } = useOffline()
  const { data, error, loading, refetch } = useApi(`/customers/${id}`)
  const [tab, setTab] = useState('milk')
  const [payOpen, setPayOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (loading && !data) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const c = data.data
  const summary = data.last_10_days
  const balance = parseFloat(data.balance)
  const pending = parseFloat(summary.pending_amount)

  const remove = async () => {
    try {
      const { data: res } = await api.delete(`/customers/${c.id}`)
      toast.success(res.deleted ? t('customers.deleted') : t('customers.deactivated'))
      reloadCustomers()
      if (res.deleted) navigate('/customers', { replace: true })
      else refetch()
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white tabular">{c.code}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">{c.name}</h1>
            <Badge tone={c.status === 'active' ? 'green' : 'gray'} dot>{t(`common.${c.status}`)}</Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {c.mobile && <a href={`tel:${c.mobile}`} className="inline-flex items-center gap-1 hover:text-brand-700"><Phone className="size-3.5" />{c.mobile}</a>}
            {c.village && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{c.village}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {can('customers.manage') && (
            <>
              <Link to={`/customers/${c.id}/edit`}><Button variant="secondary" icon={Pencil}>{t('common.edit')}</Button></Link>
              <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label={t('common.delete')}><Trash2 className="size-4.5 text-slate-500" /></Button>
            </>
          )}
        </div>
      </div>

      {/* Primary actions */}
      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {can('milk.create') && c.status === 'active' && (
          <Link to={`/collection?customer=${c.id}`}><Button size="lg" icon={Milk} className="w-full">{t('customers.add_milk')}</Button></Link>
        )}
        {can('bills.manage') && (
          <Link to={`/bills/new?customer=${c.id}`}><Button size="lg" variant="secondary" icon={FileText} className="w-full">{t('customers.generate_bill')}</Button></Link>
        )}
        {can('payments.manage') && (
          <Button size="lg" variant="success" icon={Wallet} className="w-full" onClick={() => setPayOpen(true)}>{t('customers.receive_payment')}</Button>
        )}
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        {/* Today */}
        <Card>
          <CardHeader title={t('customers.today_milk')} />
          <div className="grid grid-cols-2 divide-x divide-line">
            {['morning', 'evening'].map((s) => {
              const e = data.today[s]
              const Icon = s === 'morning' ? Sun : Moon
              return (
                <div key={s} className="p-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Icon className="size-3.5" />{t(`common.${s}`)}</p>
                  {e ? (
                    <>
                      <p className="tabular mt-1 text-xl font-bold text-slate-900">{qty(e.quantity)} {t('common.litre')}</p>
                      <p className="tabular text-sm text-slate-500">{money(e.amount)}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">{t('customers.not_entered')}</p>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Balance */}
        <Card className={cn('p-4', pending > 0 ? 'border-amber-200 bg-amber-50/40' : '')}>
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><IndianRupee className="size-3.5" />{t('customers.current_balance')}</p>
          <p className={cn('tabular mt-1 text-3xl font-bold', pending > 0 ? 'text-amber-700' : 'text-emerald-700')}>{money(Math.abs(pending))}</p>
          <p className="text-sm text-slate-500">{pending >= 0 ? t('customers.balance_due') : t('customers.balance_advance')}</p>
          <div className="mt-3 border-t border-line pt-2">
            <Row label={t('billing.outstanding')} value={money(balance)} />
            <Row label={t('customers.unbilled')} value={`${money(data.unbilled.amount)} · ${qty(data.unbilled.quantity)} ${t('common.litre')}`} />
          </div>
        </Card>

        {/* Last 10 days */}
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">{t('customers.last_10_days')}</p>
          <p className="text-xs text-slate-400">{fmtDate(summary.from)} – {fmtDate(summary.to)}</p>
          <div className="mt-2">
            <Row label={t('customers.total_milk')} value={`${qty(summary.total_milk)} ${t('common.litre')}`} />
            <Row label={t('customers.total_amount')} value={money(summary.total_amount)} />
            <Row label={t('customers.paid_amount')} value={money(summary.paid_amount)} />
            <Row label={t('customers.pending_amount')} value={money(summary.pending_amount)} strong />
          </div>
        </Card>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-3 w-full sm:w-auto"
        options={[
          { value: 'milk', label: t('customers.milk_history') },
          { value: 'bills', label: t('customers.bills') },
          { value: 'payments', label: t('customers.payments') },
        ]}
      />

      {tab === 'milk' && <EntriesList params={{ customer_id: c.id, per_page: 20 }} showCustomer={false} />}
      {tab === 'bills' && <CustomerBills customerId={c.id} suggested={data.suggested_period} />}
      {tab === 'payments' && <CustomerPayments customerId={c.id} key={payOpen ? 'a' : 'b'} />}

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        customer={c}
        outstanding={data.balance}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title={t('common.delete')}
        message={t('customers.delete_confirm')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

function CustomerBills({ customerId, suggested }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const { data, loading, error, refetch } = useApi(`/customers/${customerId}/bills`, { page })

  const columns = [
    { key: 'bill_no', header: t('billing.bill_no'), mobile: 'title', render: (b) => <span className="font-semibold">{b.bill_no}</span> },
    { key: 'period', header: t('billing.period'), mobile: 'subtitle', render: (b) => periodLabel({ start: b.period_start, end: b.period_end }) },
    { key: 'status', header: t('common.status'), mobile: 'subtitle', render: (b) => <BillStatusBadge status={b.status} /> },
    { key: 'total_qty', header: t('billing.total_milk'), align: 'right', render: (b) => `${qty(b.total_qty)} ${t('common.litre')}` },
    { key: 'net_payable', header: t('billing.net_payable'), align: 'right', render: (b) => money(b.net_payable) },
    { key: 'outstanding', header: t('billing.outstanding'), align: 'right', mobile: 'value', render: (b) => money(b.outstanding) },
  ]

  return (
    <Card>
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={loading}
          onRowClick={(b) => navigate(`/bills/${b.id}`)}
          empty={
            <EmptyState
              icon={FileText}
              title={t('billing.empty_title')}
              text={periodLabel(suggested)}
              action={<Link to={`/bills/new?customer=${customerId}`}><Button icon={FileText}>{t('customers.generate_bill')}</Button></Link>}
            />
          }
        />
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
    </Card>
  )
}

function CustomerPayments({ customerId }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const { data, loading, error, refetch } = useApi(`/customers/${customerId}/payments`, { page })

  const columns = [
    { key: 'payment_date', header: t('payments.date'), mobile: 'title', render: (p) => fmtDate(p.payment_date) },
    { key: 'method', header: t('payments.method'), mobile: 'subtitle', render: (p) => t(`payments.methods.${p.method}`) },
    { key: 'bill_no', header: t('payments.bill'), mobile: 'subtitle', render: (p) => p.bill_no || t('payments.advance') },
    { key: 'reference', header: t('payments.reference'), render: (p) => p.reference || '–' },
    { key: 'amount', header: t('payments.amount'), align: 'right', mobile: 'value', render: (p) => <span className="font-semibold text-emerald-700">{money(p.amount)}</span> },
  ]

  return (
    <Card>
      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <DataTable columns={columns} rows={data?.data} loading={loading} empty={<EmptyState icon={Wallet} title={t('payments.empty_title')} />} />
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
    </Card>
  )
}
