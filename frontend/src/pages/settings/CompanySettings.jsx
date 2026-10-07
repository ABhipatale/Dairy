import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Trash2 } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button, Card, ErrorState, Field, Input, PageHeader, Select, Spinner, Textarea } from '../../components/ui'

const FIELDS = [
  ['name', true], ['owner_name'], ['mobile'], ['whatsapp_number'], ['email'], ['gst_number'],
  ['city'], ['state'], ['pincode'], ['country'],
]

/** Company profile & branding (shown on bills, receipts, PDFs and WhatsApp). */
export default function CompanySettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const { refresh } = useAuth()
  const [form, setForm] = useState(null)
  const [logo, setLogo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setForm(Object.fromEntries(Object.entries(data.company).map(([k, v]) => [k, v ?? ''])))
      setPreview(data.company.logo_url)
    }).catch(setError)
  }, [])

  if (error) return <ErrorState error={error} />
  if (!form) return <Spinner />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const body = new FormData()
    const keys = [...FIELDS.map(([k]) => k), 'address', 'currency', 'timezone', 'default_language', 'invoice_footer', 'thank_you_message']
    keys.forEach((k) => body.append(k, form[k] ?? ''))
    if (logo) body.append('logo', logo)
    if (removeLogo) body.append('remove_logo', '1')

    try {
      const { data } = await api.post('/settings/company', body)
      setPreview(data.data.logo_url)
      setLogo(null)
      setRemoveLogo(false)
      toast.success(t('settings.saved'))
      refresh().catch(() => {})
    } catch (err) {
      setErrors(err.errors || {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const err = (k) => errors[k]?.[0]

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl">
      <PageHeader title={t('settings.company')} back="/settings" />

      <Card className="mb-4 flex items-center gap-4 p-4 sm:p-5">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-slate-50">
          {preview ? <img src={preview} alt="" className="size-full object-contain" /> : <ImagePlus className="size-7 text-slate-300" />}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{t('settings.company_fields.logo')}</p>
          <p className="text-xs text-slate-500">{t('settings.company_fields.logo_hint')}</p>
          {err('logo') && <p className="text-xs text-rose-600">{err('logo')}</p>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>{t('settings.company_fields.upload_logo')}</Button>
            {preview && (
              <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => { setPreview(null); setLogo(null); setRemoveLogo(true) }}>
                {t('settings.company_fields.remove_logo')}
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setLogo(f)
              setRemoveLogo(false)
              setPreview(URL.createObjectURL(f))
            }}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([k, required]) => (
            <Field key={k} label={t(`settings.company_fields.${k}`)} required={required} error={err(k)}>
              {({ id, invalid }) => <Input id={id} invalid={invalid} value={form[k]} onChange={set(k)} required={required} />}
            </Field>
          ))}
        </div>
        <Field label={t('settings.company_fields.address')} error={err('address')}>
          {({ id }) => <Textarea id={id} rows={2} value={form.address} onChange={set('address')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.company_fields.default_language')}>
            {({ id }) => (
              <Select id={id} value={form.default_language} onChange={set('default_language')}>
                <option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिंदी</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label={t('settings.company_fields.thank_you_message')} error={err('thank_you_message')}>
          {({ id }) => <Input id={id} value={form.thank_you_message} onChange={set('thank_you_message')} />}
        </Field>
        <Field label={t('settings.company_fields.invoice_footer')} error={err('invoice_footer')}>
          {({ id }) => <Textarea id={id} rows={2} value={form.invoice_footer} onChange={set('invoice_footer')} />}
        </Field>
      </Card>

      <div className="mt-4 flex justify-end">
        <Button type="submit" size="lg" loading={saving}>{t('common.save')}</Button>
      </div>
    </form>
  )
}
