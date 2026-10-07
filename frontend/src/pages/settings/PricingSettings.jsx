import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IndianRupee, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import api from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Segmented,
} from '../../components/ui'
import { currencySymbol, fmtDate, isoDate, money, round2 } from '../../utils/format'

/** Effective-dated rates. History is kept; entries keep the rate they were saved with. */
export default function PricingSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const { refresh } = useAuth()
  const { data, error, loading, refetch } = useApi('/milk-prices')
  const today = useApi('/milk-entries/prices')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const startAdd = () => {
    setForm({ effective_from: isoDate(), session: 'both', method: 'fixed', rate: '', fat_rate: '', min_rate: '' })
    setErrors({})
    setOpen(true)
  }

  const reloadAll = () => {
    refetch()
    today.refetch()
    refresh().catch(() => {})
  }

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      const body = { ...form }
      ;['rate', 'fat_rate', 'min_rate'].forEach((k) => body[k] === '' && (body[k] = null))
      await api.post('/milk-prices', body)
      toast.success(t('settings.pricing_fields.added'))
      setOpen(false)
      reloadAll()
    } catch (e) {
      setErrors(e.errors || {})
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/milk-prices/${deleting.id}`)
      toast.success(t('settings.pricing_fields.deleted'))
      reloadAll()
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }

  const describe = (p) =>
    !p ? t('settings.pricing_fields.none')
      : p.method === 'fat'
        ? `${t('settings.pricing_fields.fat')}: ${money(p.fat_rate)} × ${t('common.fat')}${p.min_rate ? ` (min ${money(p.min_rate)})` : ''}`
        : `${money(p.rate)}${t('common.per_litre')}`

  const columns = [
    { key: 'effective_from', header: t('settings.pricing_fields.effective_from'), mobile: 'title', render: (p) => fmtDate(p.effective_from) },
    { key: 'session', header: t('settings.pricing_fields.applies_to'), mobile: 'subtitle', render: (p) => <Badge tone={p.session === 'morning' ? 'amber' : p.session === 'evening' ? 'violet' : 'gray'}>{t(`common.${p.session}`)}</Badge> },
    { key: 'method', header: t('settings.pricing_fields.method'), mobile: 'subtitle', render: (p) => t(`settings.pricing_fields.${p.method}`) },
    { key: 'rate', header: t('common.rate'), mobile: 'value', align: 'right', render: describe },
    {
      key: 'x', header: '', mobile: 'hide', className: 'w-10',
      render: (p) => (
        <button type="button" onClick={() => setDeleting(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={t('common.delete')}>
          <Trash2 className="size-4" />
        </button>
      ),
    },
  ]

  const f = form
  const example = f.method === 'fat' && f.fat_rate ? round2(6.2 * Number(f.fat_rate)).toFixed(2) : null

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('settings.pricing')} back="/settings" actions={<Button icon={Plus} onClick={startAdd}>{t('settings.pricing_fields.add')}</Button>} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {['morning', 'evening'].map((s) => {
          const p = today.data?.prices?.[s]
          const Icon = s === 'morning' ? Sun : Moon
          return (
            <Card key={s} className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Icon className="size-3.5" />{t(`common.${s}`)} · {t('settings.pricing_fields.current')}</p>
              <p className="tabular mt-1 text-2xl font-bold text-slate-900">{describe(p)}</p>
              {p && <p className="text-xs text-slate-400">{t('settings.pricing_fields.effective_from')} {fmtDate(p.effective_from)}</p>}
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader title={t('settings.pricing_fields.history')} subtitle={t('settings.pricing_fields.history_note')} />
        {error ? <ErrorState error={error} onRetry={refetch} /> : (
          <DataTable columns={columns} rows={data?.data} loading={loading} empty={<EmptyState icon={IndianRupee} title={t('settings.pricing_fields.none')} action={<Button icon={Plus} onClick={startAdd}>{t('settings.pricing_fields.add')}</Button>} />} />
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('settings.pricing_fields.add')}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save} loading={saving}>{t('common.save')}</Button></>}
      >
        <div className="space-y-4">
          <Field label={t('settings.pricing_fields.effective_from')} error={errors.effective_from?.[0]}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} type="date" value={f.effective_from || ''} onChange={(e) => setForm({ ...f, effective_from: e.target.value })} />}
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('settings.pricing_fields.applies_to')}</span>
            <Segmented value={f.session} onChange={(v) => setForm({ ...f, session: v })} className="w-full"
              options={[{ value: 'both', label: t('common.both') }, { value: 'morning', label: t('common.morning') }, { value: 'evening', label: t('common.evening') }]} />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('settings.pricing_fields.method')}</span>
            <Segmented value={f.method} onChange={(v) => setForm({ ...f, method: v })} className="w-full"
              options={[{ value: 'fixed', label: t('settings.pricing_fields.fixed') }, { value: 'fat', label: t('settings.pricing_fields.fat') }]} />
          </div>
          {f.method === 'fixed' ? (
            <Field label={t('settings.pricing_fields.rate')} error={errors.rate?.[0]}>
              {({ id, invalid }) => <Input id={id} invalid={invalid} size="lg" type="number" inputMode="decimal" step="0.01" prefix={currencySymbol()} value={f.rate} onChange={(e) => setForm({ ...f, rate: e.target.value })} />}
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('settings.pricing_fields.fat_rate')} error={errors.fat_rate?.[0]}>
                {({ id, invalid }) => <Input id={id} invalid={invalid} type="number" inputMode="decimal" step="0.01" prefix={currencySymbol()} value={f.fat_rate} onChange={(e) => setForm({ ...f, fat_rate: e.target.value })} />}
              </Field>
              <Field label={t('settings.pricing_fields.min_rate')} error={errors.min_rate?.[0]}>
                {({ id, invalid }) => <Input id={id} invalid={invalid} type="number" inputMode="decimal" step="0.01" prefix={currencySymbol()} value={f.min_rate} onChange={(e) => setForm({ ...f, min_rate: e.target.value })} />}
              </Field>
              {example && <p className="col-span-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{t('settings.pricing_fields.fat_example', { rate: f.fat_rate, result: example })}</p>}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title={t('common.delete')} message={t('settings.pricing_fields.delete_confirm')} confirmLabel={t('common.delete')} />
    </div>
  )
}
