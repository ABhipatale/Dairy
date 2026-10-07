import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'

const FIELDS = ['owner_name', 'mobile', 'whatsapp_number', 'email', 'city', 'state', 'country', 'pincode', 'gst_number']

/** Super admin: create a dairy company (with its first admin) or edit one. */
export function TenantFormModal({ open, onClose, tenant, onSaved }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(tenant
      ? Object.fromEntries(Object.entries(tenant).map(([k, v]) => [k, v ?? '']))
      : { name: '', country: 'India', currency: 'INR', timezone: 'Asia/Kolkata', default_language: 'mr', status: 'active', admin_name: '', admin_mobile: '', admin_email: '', admin_password: '' })
  }, [open, tenant])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const err = (k) => errors[k]?.[0]

  const save = async () => {
    setSaving(true)
    setErrors({})
    const keys = ['name', ...FIELDS, 'address', 'currency', 'timezone', 'default_language', 'status', 'plan', 'subscription_ends_at',
      ...(tenant ? [] : ['admin_name', 'admin_mobile', 'admin_email', 'admin_password'])]
    const body = Object.fromEntries(keys.map((k) => [k, form[k] === '' ? null : form[k]]))

    try {
      const { data } = tenant ? await api.put(`/admin/tenants/${tenant.id}`, body) : await api.post('/admin/tenants', body)
      toast.success(t(tenant ? 'admin.updated' : 'admin.created'))
      onSaved?.(data.data)
      onClose()
    } catch (e) {
      setErrors(e.errors || {})
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={tenant ? t('admin.edit_company') : t('admin.add_company')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save} loading={saving}>{t('common.save')}</Button></>}
    >
      <div className="space-y-4">
        <Field label={t('settings.company_fields.name')} required error={err('name')}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} value={form.name || ''} onChange={set('name')} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((k) => (
            <Field key={k} label={t(`settings.company_fields.${k}`)} error={err(k)}>
              {({ id, invalid }) => <Input id={id} invalid={invalid} value={form[k] || ''} onChange={set(k)} />}
            </Field>
          ))}
          <Field label={t('settings.company_fields.default_language')}>
            {({ id }) => (
              <Select id={id} value={form.default_language} onChange={set('default_language')}>
                <option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिंदी</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label={t('settings.company_fields.address')}>
          {({ id }) => <Textarea id={id} rows={2} value={form.address || ''} onChange={set('address')} />}
        </Field>

        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
          <p className="text-sm font-semibold text-slate-800 sm:col-span-3">{t('admin.subscription')}</p>
          <Field label={t('common.status')}>
            {({ id }) => (
              <Select id={id} value={form.status} onChange={set('status')}>
                {['active', 'inactive', 'suspended'].map((s) => <option key={s} value={s}>{t(`admin.status_${s}`)}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t('admin.plan')}>{({ id }) => <Input id={id} value={form.plan || ''} onChange={set('plan')} />}</Field>
          <Field label={t('admin.subscription_ends_at')} error={err('subscription_ends_at')}>
            {({ id }) => <Input id={id} type="date" value={(form.subscription_ends_at || '').slice(0, 10)} onChange={set('subscription_ends_at')} />}
          </Field>
        </div>

        {!tenant && (
          <div className="grid gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3 sm:grid-cols-2">
            <p className="text-sm font-semibold text-slate-800 sm:col-span-2">{t('admin.company_admin')}</p>
            {['admin_name', 'admin_mobile', 'admin_email', 'admin_password'].map((k) => (
              <Field key={k} label={t(`admin.${k}`)} required={k !== 'admin_email'} error={err(k)}>
                {({ id, invalid }) => <Input id={id} invalid={invalid} type={k === 'admin_password' ? 'password' : 'text'} autoComplete="off" value={form[k] || ''} onChange={set(k)} />}
              </Field>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
