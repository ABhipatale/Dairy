import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { Button, Field, Input, Modal, Toggle } from './ui'

/** Super admin: change the company's single login (mobile, email, password) or block it. */
export function CompanyLoginModal({ open, onClose, tenantId, login, onSaved }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !login) return
    setForm({ name: login.name, mobile: login.mobile, email: login.email || '', password: '', is_active: login.is_active })
    setErrors({})
  }, [open, login])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    setErrors({})
    const body = { ...form, email: form.email || null }
    if (!body.password) delete body.password
    try {
      const { data } = await api.put(`/admin/tenants/${tenantId}/login`, body)
      toast.success(t('admin.login_updated'))
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
      title={t('admin.company_login')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save} loading={saving}>{t('common.save')}</Button></>}
    >
      <div className="space-y-4">
        <Field label={t('common.name')} error={errors.name?.[0]}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} value={form.name || ''} onChange={set('name')} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('common.mobile')} hint={t('admin.login_mobile_hint')} error={errors.mobile?.[0]}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} type="tel" inputMode="tel" value={form.mobile || ''} onChange={set('mobile')} />}
          </Field>
          <Field label={t('common.email')} error={errors.email?.[0]}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} type="email" value={form.email || ''} onChange={set('email')} />}
          </Field>
        </div>
        <Field label={t('admin.new_password')} hint={t('admin.password_keep_hint')} error={errors.password?.[0]}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} type="password" autoComplete="new-password" value={form.password || ''} onChange={set('password')} />}
        </Field>
        <Toggle label={t('admin.login_active')} description={t('admin.login_active_hint')} checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
      </div>
    </Modal>
  )
}
