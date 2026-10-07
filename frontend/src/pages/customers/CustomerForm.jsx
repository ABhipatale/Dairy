import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useOffline } from '../../context/OfflineContext'
import { useToast } from '../../context/ToastContext'
import { upsertCachedCustomer } from '../../services/customerCache'
import { currencySymbol } from '../../utils/format'
import { Button, Card, Field, Input, PageHeader, Segmented, Spinner, Textarea } from '../../components/ui'

const EMPTY = { code: '', name: '', mobile: '', whatsapp: '', address: '', village: '', opening_balance: '', status: 'active', notes: '' }

export default function CustomerForm() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { tenant } = useAuth()
  const { tenantId } = useOffline()
  const editing = !!id

  const [form, setForm] = useState(EMPTY)
  const [sameWa, setSameWa] = useState(true)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(editing)
  const [nextCode, setNextCode] = useState('')

  useEffect(() => {
    if (editing) {
      api.get(`/customers/${id}`).then(({ data }) => {
        const c = data.data
        setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ''])) })
        setSameWa(!c.whatsapp || c.whatsapp === c.mobile)
        setLoading(false)
      }).catch((e) => { toast.error(e.message); navigate('/customers') })
    } else {
      api.get('/customers/next-code').then(({ data }) => setNextCode(data.code)).catch(() => {})
    }
  }, [id, editing, navigate, toast])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e, { addAnother = false } = {}) => {
    e?.preventDefault()
    setSaving(true)
    setErrors({})

    const payload = { ...form, whatsapp: sameWa ? null : form.whatsapp, opening_balance: form.opening_balance || 0 }
    Object.keys(payload).forEach((k) => payload[k] === '' && (payload[k] = null))

    try {
      const { data } = editing ? await api.put(`/customers/${id}`, payload) : await api.post('/customers', payload)
      await upsertCachedCustomer(tenantId ?? tenant?.id, data.data)
      toast.success(t(editing ? 'customers.updated' : 'customers.created'))

      if (addAnother) {
        setForm(EMPTY)
        api.get('/customers/next-code').then(({ data: d }) => setNextCode(d.code)).catch(() => {})
        document.getElementById('cust-name')?.focus()
      } else {
        navigate(`/customers/${data.data.id}`, { replace: true })
      }
    } catch (err) {
      setErrors(err.errors || {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  const err = (k) => errors[k]?.[0]

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={editing ? t('customers.edit') : t('customers.new')} back />

      <form onSubmit={submit}>
        <Card className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Field label={t('customers.code')} hint={!editing ? t('customers.code_hint') : null} error={err('code')}>
              {({ id: fid, invalid }) => (
                <Input id={fid} invalid={invalid} value={form.code} onChange={set('code')} placeholder={nextCode} inputMode="numeric" className="tabular" />
              )}
            </Field>
            <Field label={t('customers.name')} required error={err('name')}>
              {({ invalid }) => (
                <Input id="cust-name" invalid={invalid} value={form.name} onChange={set('name')} autoFocus required autoComplete="off" />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('customers.mobile')} error={err('mobile')}>
              {({ id: fid, invalid }) => (
                <Input id={fid} invalid={invalid} type="tel" inputMode="tel" value={form.mobile} onChange={set('mobile')} maxLength={15} />
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{t('customers.whatsapp')}</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={sameWa} onChange={(e) => setSameWa(e.target.checked)} className="size-4 rounded accent-brand-600" />
                  {t('customers.same_as_mobile')}
                </label>
              </div>
              <Input type="tel" inputMode="tel" value={sameWa ? form.mobile : form.whatsapp} onChange={set('whatsapp')} disabled={sameWa} invalid={!!err('whatsapp')} aria-label={t('customers.whatsapp')} />
              {err('whatsapp') && <p className="text-xs font-medium text-rose-600">{err('whatsapp')}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('customers.village')} error={err('village')}>
              {({ id: fid }) => <Input id={fid} value={form.village} onChange={set('village')} />}
            </Field>
            <Field label={t('customers.opening_balance')} hint={t('customers.opening_balance_hint')} error={err('opening_balance')}>
              {({ id: fid, invalid }) => (
                <Input id={fid} invalid={invalid} type="number" inputMode="decimal" step="0.01" value={form.opening_balance} onChange={set('opening_balance')} prefix={currencySymbol()} />
              )}
            </Field>
          </div>

          <Field label={t('customers.address')} error={err('address')}>
            {({ id: fid }) => <Textarea id={fid} rows={2} value={form.address} onChange={set('address')} />}
          </Field>

          <Field label={t('customers.notes')}>
            {({ id: fid }) => <Textarea id={fid} rows={2} value={form.notes} onChange={set('notes')} />}
          </Field>

          {editing && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('common.status')}</span>
              <Segmented
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                options={[{ value: 'active', label: t('common.active') }, { value: 'inactive', label: t('common.inactive') }]}
              />
            </div>
          )}
        </Card>

        <div className="safe-bottom sticky bottom-20 z-10 mt-4 flex flex-col-reverse gap-2 sm:static sm:flex-row sm:justify-end lg:bottom-0">
          <Button variant="secondary" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          {!editing && (
            <Button variant="secondary" onClick={(e) => submit(e, { addAnother: true })} disabled={saving || !form.name}>
              {t('common.save')} + {t('common.add')}
            </Button>
          )}
          <Button type="submit" size="lg" loading={saving} disabled={!form.name}>{t('common.save')}</Button>
        </div>
      </form>
    </div>
  )
}
