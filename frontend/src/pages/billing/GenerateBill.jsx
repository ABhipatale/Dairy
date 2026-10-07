import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, FileCheck2, FileText } from 'lucide-react'
import api from '../../services/api'
import { useOffline } from '../../context/OfflineContext'
import { useToast } from '../../context/ToastContext'
import { CustomerPicker } from '../../components/CustomerPicker'
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Row, SessionBadge, Spinner } from '../../components/ui'
import { currencySymbol, fmtDate, money, periodLabel, qty } from '../../utils/format'
import { useDebounce } from '../../hooks/useApi'

/** Customer → period (auto-suggested) → live preview → Generate. */
export default function GenerateBill() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { customers } = useOffline()
  const [params] = useSearchParams()

  const [customer, setCustomer] = useState(null)
  const [periodStart, setPeriodStart] = useState(null) // null = server suggests
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const debouncedDiscount = useDebounce(discount, 400)

  useEffect(() => {
    const id = Number(params.get('customer'))
    if (id && !customer) {
      const c = customers.find((x) => x.id === id)
      if (c) setCustomer(c)
    }
  }, [params, customers, customer])

  const load = useCallback(async () => {
    if (!customer) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post('/bills/preview', {
        customer_id: customer.id,
        period_start: periodStart || undefined,
        discount: debouncedDiscount || 0,
      })
      setResult(data)
      if (!periodStart) setPeriodStart(data.period.start)
    } catch (e) {
      setError(e)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [customer, periodStart, debouncedDiscount])

  useEffect(() => {
    load()
  }, [load])

  const generate = async () => {
    setSaving(true)
    try {
      const { data } = await api.post('/bills', { customer_id: customer.id, period_start: periodStart, discount: discount || 0, notes: notes || null })
      toast.success(t('billing.generated'))
      navigate(`/bills/${data.data.id}`, { replace: true })
    } catch (e) {
      toast.error(e.message)
      if (e.context?.bill_id) navigate(`/bills/${e.context.bill_id}`)
    } finally {
      setSaving(false)
    }
  }

  const shift = (which) => setPeriodStart(result?.[which]?.start)
  const p = result?.preview

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('billing.generate_title')} back />

      <Card className="mb-4 p-4">
        <CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setPeriodStart(null); setResult(null) }} includeInactive autoFocus placeholder={t('billing.choose_customer')} />
      </Card>

      {customer && (
        <>
          <Card className="mb-4 flex items-center gap-2 p-2">
            <Button variant="ghost" size="icon" onClick={() => shift('previous_period')} disabled={!result} aria-label={t('billing.prev_period')}>
              <ChevronLeft className="size-5" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-xs font-medium text-slate-500">{t('billing.period')}</p>
              <p className="tabular text-base font-bold text-slate-900">{result ? periodLabel(result.period) : '…'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => shift('next_period')} disabled={!result} aria-label={t('billing.next_period')}>
              <ChevronRight className="size-5" />
            </Button>
          </Card>

          {loading && !p && <Spinner />}

          {error && (
            <Card>
              <EmptyState
                icon={FileText}
                title={error.message}
                action={error.context?.bill_id && <Button variant="secondary" onClick={() => navigate(`/bills/${error.context.bill_id}`)}>{t('common.view')}</Button>}
              />
            </Card>
          )}

          {p && p.entry_count === 0 && (
            <Card><EmptyState icon={FileText} title={t('billing.no_entries')} text={periodLabel(result.period)} /></Card>
          )}

          {p && p.entry_count > 0 && (
            <div className="grid gap-4 md:grid-cols-[1fr_300px]">
              <Card>
                <CardHeader title={t('billing.items')} subtitle={`${p.entry_count} ${t('common.entries')}`} />
                <div className="max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">{t('common.date')}</th>
                        <th className="px-2 py-2 text-left">{t('common.session')}</th>
                        <th className="px-2 py-2 text-right">{t('common.milk')}</th>
                        <th className="hidden px-2 py-2 text-right sm:table-cell">{t('common.fat')}</th>
                        <th className="hidden px-2 py-2 text-right sm:table-cell">{t('common.rate')}</th>
                        <th className="px-4 py-2 text-right">{t('common.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="tabular divide-y divide-line">
                      {p.items.map((i) => (
                        <tr key={i.milk_entry_id}>
                          <td className="px-4 py-2">{fmtDate(i.entry_date).slice(0, 5)}</td>
                          <td className="px-2 py-2"><SessionBadge session={i.session} /></td>
                          <td className="px-2 py-2 text-right">{qty(i.quantity)}</td>
                          <td className="hidden px-2 py-2 text-right sm:table-cell">{i.fat ? qty(i.fat) : '–'}</td>
                          <td className="hidden px-2 py-2 text-right sm:table-cell">{qty(i.rate)}</td>
                          <td className="px-4 py-2 text-right font-medium">{qty(i.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="space-y-4">
                <Card className="p-4">
                  <Row label={t('billing.total_milk')} value={`${qty(p.total_qty)} ${t('common.litre')}`} />
                  {p.avg_fat && <Row label={t('billing.avg_fat')} value={qty(p.avg_fat)} />}
                  <Row label={t('billing.total_amount')} value={money(p.total_amount)} />
                  <Row label={t('billing.previous_balance')} value={money(p.previous_balance)} />
                  <Row label={t('billing.discount')} value={`- ${money(p.discount)}`} />
                  <div className="mt-2 border-t border-line pt-2">
                    <Row label={t('billing.net_payable')} value={money(p.net_payable)} strong />
                  </div>
                </Card>

                <Card className="space-y-3 p-4">
                  <Field label={t('billing.discount')}>
                    {({ id }) => <Input id={id} type="number" inputMode="decimal" min="0" step="0.01" prefix={currencySymbol()} value={discount} onChange={(e) => setDiscount(e.target.value)} />}
                  </Field>
                  <Field label={t('common.notes')}>
                    {({ id }) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
                  </Field>
                  <Button size="lg" icon={FileCheck2} className="w-full" onClick={generate} loading={saving} disabled={loading}>
                    {t('billing.generate')}
                  </Button>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
