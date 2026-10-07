import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Button, Card, CardHeader, Field, Input, PageHeader } from '../components/ui'

export default function Profile() {
  const { t } = useTranslation()
  const { user, tenant, logout, updateSession } = useAuth()
  const toast = useToast()
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const changePassword = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const { data } = await api.put('/auth/profile', pw)
      updateSession({ user: data.user })
      setPw({ current_password: '', password: '', password_confirmation: '' })
      toast.success(t('profile.password_changed'))
    } catch (err) {
      setErrors(err.errors || {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k) => (e) => setPw((p) => ({ ...p, [k]: e.target.value }))

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title={t('profile.title')} />

      <Card className="flex items-center gap-4 p-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">{user?.name?.[0]?.toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-slate-900">{user?.name}</p>
          <p className="text-sm text-slate-500">{user?.mobile}</p>
          {tenant && <p className="text-sm text-slate-500">{tenant.name}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('profile.language')} />
        <div className="p-4"><LanguageSwitcher /></div>
      </Card>

      <Card as="form" onSubmit={changePassword}>
        <CardHeader title={t('profile.change_password')} />
        <div className="space-y-3 p-4">
          <Field label={t('profile.current_password')} error={errors.current_password?.[0]}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} type="password" autoComplete="current-password" value={pw.current_password} onChange={set('current_password')} />}
          </Field>
          <Field label={t('profile.new_password')} error={errors.password?.[0]}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} type="password" autoComplete="new-password" value={pw.password} onChange={set('password')} />}
          </Field>
          <Field label={t('profile.confirm_password')}>
            {({ id }) => <Input id={id} type="password" autoComplete="new-password" value={pw.password_confirmation} onChange={set('password_confirmation')} />}
          </Field>
          <Button type="submit" loading={saving} disabled={!pw.current_password || !pw.password}>{t('common.save')}</Button>
        </div>
      </Card>

      <Button variant="danger-ghost" icon={LogOut} className="w-full" onClick={logout}>{t('nav.logout')}</Button>
    </div>
  )
}
