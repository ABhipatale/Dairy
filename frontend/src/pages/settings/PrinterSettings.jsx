import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bluetooth, CheckCircle2, Printer } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useSettings } from '../../hooks/useSettings'
import { SettingsCard } from '../../components/SettingsForm'
import { Button, Card, CardHeader, ErrorState, PageHeader, Segmented, Spinner, Toggle } from '../../components/ui'
import { buildEntryReceipt, buildTestReceipt } from '../../services/print/receipt'
import { previewDataUrl, printDocument } from '../../services/print/printService'
import { bluetoothDeviceName, bluetoothSupported, connectBluetooth } from '../../services/print/transports'
import { cn } from '../../utils/cn'
import { isoDate } from '../../utils/format'

const CHOICES = [
  { value: 'browser', icon: Printer },
  { value: 'bluetooth', icon: Bluetooth },
]

export default function PrinterSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const { tenant } = useAuth()
  const { data, error, saving, save } = useSettings()
  const [preview, setPreview] = useState(null)
  const [device, setDevice] = useState(bluetoothDeviceName())
  const [testing, setTesting] = useState(false)

  const printer = data?.settings?.printer

  // Live preview of the receipt as it will print.
  useEffect(() => {
    if (!printer) return
    const sample = {
      entry_date: isoDate(), session: 'morning', quantity: '5.50', fat: '6.20', rate: '52.00', amount: '286.00',
      customer: { name: 'Ramesh Patil', code: '12', mobile: '9876543210' },
    }
    previewDataUrl(buildEntryReceipt({ entry: sample, tenant, printer, t }), printer.paper_size).then(setPreview).catch(() => {})
  }, [printer, tenant, t])

  if (error) return <ErrorState error={error} />
  if (!data) return <Spinner />

  const failed = (e) => {
    if (e?.code !== 'cancelled') toast.error(e?.code === 'unsupported' ? t('print.unsupported') : t('print.failed'))
  }

  const test = async (draft) => {
    setTesting(true)
    try {
      await printDocument(buildTestReceipt({ tenant, printer: draft, t }), draft)
      toast.success(t('print.test_ok'))
    } catch (e) {
      failed(e)
    } finally {
      setTesting(false)
    }
  }

  const connect = async () => {
    try {
      setDevice(await connectBluetooth())
    } catch (e) {
      failed(e)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('settings.printer')} back="/settings" />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <SettingsCard title={t('settings.printer_fields.which_printer')} values={printer} saving={saving === 'printer'} onSave={(v) => save('printer', v)}>
          {(d, set) => (
            <div className="space-y-4 py-3">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                {CHOICES.map(({ value, icon: Icon }) => {
                  const disabled = value === 'bluetooth' && !bluetoothSupported()
                  const active = d.connection_type === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={disabled}
                      onClick={() => set('connection_type', value)}
                      className={cn(
                        'flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50',
                        active ? 'border-brand-500 bg-brand-50/60' : 'border-line hover:bg-slate-50',
                      )}
                    >
                      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')}>
                        <Icon className="size-5" />
                      </span>
                      <span>
                        <span className="block font-semibold text-slate-900">{t(`settings.printer_fields.${value}`)}</span>
                        <span className="block text-xs text-slate-500">{t(`settings.printer_fields.${value}_hint`)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              {d.connection_type === 'bluetooth' && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <p>{t('settings.printer_fields.bluetooth_help')}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="secondary" icon={Bluetooth} onClick={connect}>{t('print.connect')}</Button>
                    {device ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="size-4" />{t('print.connected', { name: device })}</span>
                    ) : (
                      <span className="text-xs">{t('print.not_connected')}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('settings.printer_fields.paper_size')}</span>
                  <Segmented value={d.paper_size} onChange={(v) => set('paper_size', v)} options={[{ value: '58mm', label: '58 mm' }, { value: '80mm', label: '80 mm' }]} />
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('settings.printer_fields.copies')}</span>
                  <Segmented value={d.copies} onChange={(v) => set('copies', v)} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
                </div>
              </div>

              <div className="divide-y divide-line">
                <Toggle label={t('settings.printer_fields.auto_print')} checked={d.auto_print} onChange={(v) => set('auto_print', v)} />
                <Toggle label={t('settings.printer_fields.print_logo')} checked={d.print_logo} onChange={(v) => set('print_logo', v)} />
                <Toggle label={t('settings.printer_fields.print_customer_mobile')} checked={d.print_customer_mobile} onChange={(v) => set('print_customer_mobile', v)} />
              </div>

              <Button variant="secondary" icon={Printer} onClick={() => test(d)} loading={testing}>{t('print.test_print')}</Button>
            </div>
          )}
        </SettingsCard>

        <Card className="self-start">
          <CardHeader title={t('settings.printer_fields.preview')} subtitle={printer?.paper_size} />
          <div className="flex justify-center bg-slate-100 p-4">
            {preview ? (
              <img src={preview} alt="Receipt preview" className="w-full max-w-60 bg-white shadow-md" style={{ imageRendering: 'pixelated' }} />
            ) : <Spinner />}
          </div>
        </Card>
      </div>
    </div>
  )
}
