import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Lock, Phone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Field, Input } from '../components/ui'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

export default function Login() {
  const { t } = useTranslation()
  const { login, isAuthenticated, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ login: '', password: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to={isSuperAdmin ? '/admin' : '/'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const data = await login(form.login.trim(), form.password)
      // Warm up the most-used screen while the dashboard renders.
      import('./milk/MilkCollection')
      navigate(data.is_super_admin ? '/admin' : location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex justify-end p-4">
        <LanguageSwitcher className="w-60" />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src="/pwa-192x192.png" alt="" className="mb-4 size-16 rounded-2xl shadow-lg shadow-brand-600/20" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('auth.welcome')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('auth.subtitle')}</p>
          </div>

          <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
            {error && (
              <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700" role="alert">
                {error.message}
              </div>
            )}

            <Field label={t('auth.login_label')} error={error?.errors?.login?.[0]}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  invalid={invalid}
                  prefix={<Phone className="size-4" />}
                  inputMode={/^\d*$/.test(form.login) ? 'tel' : 'email'}
                  autoComplete="username"
                  placeholder={t('auth.login_placeholder')}
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  autoFocus
                  required
                />
              )}
            </Field>

            <Field label={t('common.password')} error={error?.errors?.password?.[0]}>
              {({ id, invalid }) => (
                <div className="relative">
                  <Input
                    id={id}
                    invalid={invalid}
                    prefix={<Lock className="size-4" />}
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('auth.password_placeholder')}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
                    aria-label={show ? t('auth.hide_password') : t('auth.show_password')}
                  >
                    {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                  </button>
                </div>
              )}
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!form.login || !form.password}>
              {busy ? t('auth.signing_in') : t('auth.sign_in')}
            </Button>
          </form>

          {import.meta.env.DEV && <p className="mt-4 text-center text-xs text-slate-400">{t('auth.demo_hint')}</p>}
        </div>
      </div>
    </div>
  )
}
