import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, CreditCard, Landmark, MoreHorizontal } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { CustomerPicker } from './CustomerPicker'
import { Button, Field, Input, Modal } from './ui'
import { cn } from '../utils/cn'
import { currencySymbol, isoDate, money } from '../utils/format'

const METHODS = [
  { value: 'cash', icon: Banknote },
  { value: 'upi', icon: CreditCard },
  { value: 'bank_transfer', icon: Landmark },
  { value: 'other', icon: MoreHorizontal },
]

/**
 * Receive a payment. With a bill: amount defaults to its outstanding.
 * Without: the server applies it to the customer's latest open bill.
 */
export function PaymentModal({ open, onClose, customer: fixedCustomer, bill, outstanding, onSaved }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [customer, setCustomer] = useState(fixedCustomer || null)
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCustomer(fixedCustomer || null)
    const due = bill ? bill.outstanding : outstanding
    setForm({
      amount: due && parseFloat(due) > 0 ? parseFloat(due).toFixed(2) : '',
      payment_date: isoDate(),
      method: 'cash',
      reference: '',
      notes: '',
    })
    setErrors({})
  }, [open, fixedCustomer, bill, outstanding])

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      const { data } = await api.post('/payments', {
        ...form,
        customer_id: customer?.id,
        bill_id: bill?.id || null,
        reference: form.reference || null,
        notes: form.notes || null,
      })
      toast.success(t('payments.recorded'))
      onSaved?.(data.data)
      onClose()
    } catch (e) {
      setErrors(e.errors || {})
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payments.add')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="success" onClick={save} loading={saving} disabled={!customer || !form.amount}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {fixedCustomer ? (
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
            <p className="font-semibold text-slate-900">{fixedCustomer.name} <span className="text-slate-400">#{fixedCustomer.code}</span></p>
            <p className="text-sm text-slate-500">
              {bill ? `${t('billing.bill_no')} ${bill.bill_no} · ${t('billing.outstanding')} ${money(bill.outstanding)}` : outstanding != null ? `${t('payments.outstanding_now')}: ${money(outstanding)}` : t('payments.auto_bill')}
            </p>
          </div>
        ) : (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('common.customer')}</span>
            <CustomerPicker value={customer} onChange={setCustomer} size="md" includeInactive />
            {errors.customer_id && <p className="mt-1 text-xs font-medium text-rose-600">{errors.customer_id[0]}</p>}
          </div>
        )}

        <Field label={t('payments.amount')} required error={errors.amount?.[0]}>
          {({ id, invalid }) => (
            <Input id={id} invalid={invalid} size="lg" type="number" inputMode="decimal" step="0.01" min="0" value={form.amount ?? ''} onChange={set('amount')} prefix={currencySymbol()} className="tabular" />
          )}
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('payments.method')}</span>
          <div className="grid grid-cols-4 gap-2" role="radiogroup">
            {METHODS.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.method === value}
                onClick={() => setForm((f) => ({ ...f, method: value }))}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-semibold transition-colors',
                  form.method === value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-slate-600 hover:bg-slate-50',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(`payments.methods.${value}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('payments.date')} error={errors.payment_date?.[0]}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} type="date" max={isoDate()} value={form.payment_date ?? ''} onChange={set('payment_date')} />}
          </Field>
          <Field label={t('payments.reference')} error={errors.reference?.[0]}>
            {({ id }) => <Input id={id} value={form.reference ?? ''} onChange={set('reference')} />}
          </Field>
        </div>

        <Field label={t('payments.notes')}>
          {({ id }) => <Input id={id} value={form.notes ?? ''} onChange={set('notes')} />}
        </Field>
      </div>
    </Modal>
  )
}
