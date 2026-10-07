import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Download, MessageSquareText, Pencil, Printer, Wallet, XCircle } from 'lucide-react'
import api, { downloadFile } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useDocumentActions } from '../../hooks/useDocumentActions'
import { PaymentModal } from '../../components/PaymentModal'
import {
  BillStatusBadge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Input, Modal, PageHeader, Row, Select, SessionBadge, Spinner,
} from '../../components/ui'
import { currencySymbol, fmtDate, money, periodLabel, qty } from '../../utils/format'

export default function BillDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const docs = useDocumentActions()
  const { data, error, loading, refetch, setData } = useApi(`/bills/${id}`)

  const [pay, setPay] = useState(false)
  const [markPaid, setMarkPaid] = useState(false)
  const [method, setMethod] = useState('cash')
  const [cancel, setCancel] = useState(false)
  const [reason, setReason] = useState('')
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discount, setDiscount] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)

  if (loading && !data) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const bill = data.data
  const live = bill.status !== 'cancelled'
  const open = live && parseFloat(bill.outstanding) > 0 && !bill.carried_forward_to_id

  const pdf = async () => {
    setPdfBusy(true)
    try {
      await downloadFile(`/bills/${bill.id}/pdf`, { download: 1 }, `${bill.bill_no}.pdf`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setPdfBusy(false)
    }
  }

  const doMarkPaid = async () => {
    try {
      const { data: res } = await api.post(`/bills/${bill.id}/mark-paid`, { method })
      setData(res)
      toast.success(t('payments.recorded'))
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }

  const doCancel = async () => {
    try {
      await api.post(`/bills/${bill.id}/cancel`, { reason: reason || null })
      toast.success(t('billing.cancelled'))
      refetch()
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }

  const saveDiscount = async () => {
    try {
      const { data: res } = await api.put(`/bills/${bill.id}`, { discount: discount || 0 })
      setData(res)
      setDiscountOpen(false)
      toast.success(t('common.saved'))
    } catch (e) {
      toast.error(e.message)
    }
  }

  // Group items by date → one row per day with morning & evening side by side.
  const days = []
  for (const it of bill.items || []) {
    let d = days.find((x) => x.date === it.entry_date)
    if (!d) days.push((d = { date: it.entry_date, items: [] }))
    d.items.push(it)
  }

  return (
    <div>
      <PageHeader
        back="/bills"
        title={bill.bill_no}
        subtitle={periodLabel({ start: bill.period_start, end: bill.period_end })}
        actions={<BillStatusBadge status={bill.status} />}
      />

      {/* Actions */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button variant="secondary" icon={Printer} loading={docs.busy === 'print'} onClick={() => docs.bill.print(bill)}>{t('common.print')}</Button>
        <Button variant="secondary" icon={Download} loading={pdfBusy} onClick={pdf}>{t('common.download_pdf')}</Button>
        {live && <Button variant="whatsapp" icon={MessageSquareText} loading={docs.busy === 'whatsapp'} onClick={() => docs.bill.whatsapp(bill, refetch)}>{t('billing.send_whatsapp')}</Button>}
        {open && can('payments.manage') && (
          <>
            <Button variant="success" icon={CheckCircle2} onClick={() => setMarkPaid(true)}>{t('billing.mark_paid')}</Button>
            <Button variant="secondary" icon={Wallet} onClick={() => setPay(true)}>{t('billing.partial_payment')}</Button>
          </>
        )}
        {live && can('bills.manage') && (
          <Button variant="danger-ghost" icon={XCircle} onClick={() => setCancel(true)} className="sm:ml-auto">{t('billing.cancel_bill')}</Button>
        )}
      </div>

      {bill.carried_forward_to_id && (
        <Link to={`/bills/${bill.carried_forward_to_id}`} className="mb-4 block rounded-xl bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800">
          {t('billing.carried_forward', { bill: `#${bill.carried_forward_to_id}` })} →
        </Link>
      )}
      {bill.status === 'cancelled' && bill.cancel_reason && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{bill.cancel_reason}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="p-4">
            <Link to={`/customers/${bill.customer.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
              {bill.customer.name} <span className="text-slate-400">#{bill.customer.code}</span>
            </Link>
            <p className="text-sm text-slate-500">{[bill.customer.mobile, bill.customer.village].filter(Boolean).join(' · ')}</p>
            <p className="mt-1 text-xs text-slate-400">{t('billing.bill_date')}: {fmtDate(bill.bill_date)}</p>
          </Card>

          <Card>
            <CardHeader title={t('billing.items')} subtitle={`${bill.entry_count} ${t('common.entries')}`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">{t('common.date')}</th>
                    <th className="px-2 py-2 text-left">{t('common.session')}</th>
                    <th className="px-2 py-2 text-right">{t('common.milk')}</th>
                    <th className="px-2 py-2 text-right">{t('common.fat')}</th>
                    <th className="px-2 py-2 text-right">{t('common.rate')}</th>
                    <th className="px-4 py-2 text-right">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {days.map((d) =>
                    d.items.map((i, idx) => (
                      <tr key={i.id} className={idx === d.items.length - 1 ? 'border-b border-line' : ''}>
                        <td className="px-4 py-2 font-medium">{idx === 0 ? fmtDate(d.date).slice(0, 5) : ''}</td>
                        <td className="px-2 py-2"><SessionBadge session={i.session} /></td>
                        <td className="px-2 py-2 text-right">{qty(i.quantity)}</td>
                        <td className="px-2 py-2 text-right">{i.fat ? qty(i.fat) : '–'}</td>
                        <td className="px-2 py-2 text-right">{qty(i.rate)}</td>
                        <td className="px-4 py-2 text-right font-medium">{qty(i.amount)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{t('billing.summary')}</h2>
            <Row label={t('billing.total_milk')} value={`${qty(bill.total_qty)} ${t('common.litre')}`} />
            {bill.avg_fat && <Row label={t('billing.avg_fat')} value={qty(bill.avg_fat)} />}
            <Row label={t('billing.total_amount')} value={money(bill.total_amount)} />
            <Row label={t('billing.previous_balance')} value={money(bill.previous_balance)} />
            <div className="flex items-center justify-between">
              <Row className="flex-1" label={t('billing.discount')} value={`- ${money(bill.discount)}`} />
              {live && can('bills.manage') && !bill.carried_forward_to_id && (
                <button type="button" onClick={() => { setDiscount(bill.discount); setDiscountOpen(true) }} className="ml-2 rounded-md p-1 text-slate-400 hover:text-brand-700" aria-label={t('billing.edit_discount')}>
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2 border-t border-line pt-2">
              <Row label={t('billing.net_payable')} value={money(bill.net_payable)} strong />
              <Row label={t('billing.paid')} value={money(bill.paid_amount)} />
            </div>
            <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
              <Row label={t('billing.outstanding')} value={money(bill.outstanding)} strong />
            </div>
          </Card>

          {bill.payments?.length > 0 && (
            <Card>
              <CardHeader title={t('billing.payments')} />
              <ul className="divide-y divide-line">
                {bill.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>
                      <span className="block font-medium text-slate-800">{fmtDate(p.payment_date)}</span>
                      <span className="text-xs text-slate-500">{t(`payments.methods.${p.method}`)}{p.reference ? ` · ${p.reference}` : ''}</span>
                    </span>
                    <span className="tabular font-semibold text-emerald-700">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <PaymentModal open={pay} onClose={() => setPay(false)} customer={bill.customer} bill={bill} onSaved={refetch} />

      <ConfirmDialog
        open={markPaid}
        onClose={() => setMarkPaid(false)}
        onConfirm={doMarkPaid}
        tone="primary"
        title={t('billing.mark_paid')}
        message={t('billing.mark_paid_confirm', { amount: money(bill.outstanding) })}
      >
        <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label={t('payments.method')}>
          {['cash', 'upi', 'bank_transfer', 'other'].map((m) => <option key={m} value={m}>{t(`payments.methods.${m}`)}</option>)}
        </Select>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancel}
        onClose={() => setCancel(false)}
        onConfirm={doCancel}
        title={t('billing.cancel_bill')}
        message={t('billing.cancel_confirm')}
        confirmLabel={t('billing.cancel_bill')}
      >
        <Input placeholder={t('billing.cancel_reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>

      <Modal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title={t('billing.edit_discount')}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setDiscountOpen(false)}>{t('common.cancel')}</Button><Button onClick={saveDiscount}>{t('common.save')}</Button></>}
      >
        <Input type="number" inputMode="decimal" min="0" step="0.01" prefix={currencySymbol()} value={discount} onChange={(e) => setDiscount(e.target.value)} />
      </Modal>
    </div>
  )
}
