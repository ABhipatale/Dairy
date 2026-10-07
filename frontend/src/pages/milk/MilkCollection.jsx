import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, CloudOff, Moon, Pencil, Sun } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useOffline } from '../../context/OfflineContext'
import { useToast } from '../../context/ToastContext'
import { useDocumentActions } from '../../hooks/useDocumentActions'
import { enqueueEntry } from '../../services/offlineQueue'
import { amountFor, rateFor } from '../../services/pricing'
import { CustomerPicker } from '../../components/CustomerPicker'
import { EntryActions } from '../../components/EntryActions'
import { EntryEditModal } from '../../components/EntryEditModal'
import { Badge, Button, Card, Input, Segmented } from '../../components/ui'
import { cn } from '../../utils/cn'
import { currentSession, fmtDate, isoDate, litres, money, qty, round2, uuid } from '../../utils/format'

/**
 * The operator's main screen. Target: < 10 s per customer.
 *   ID ⏎ → litres ⏎ → fat ⏎ (saves) → Print / WhatsApp → next customer.
 * Works offline: entries are queued with a client_uuid and synced later.
 */
export default function MilkCollection() {
  const { t } = useTranslation()
  const { settings, prices: todayPrices } = useAuth()
  const { customers, stats, tenantId } = useOffline()
  const toast = useToast()
  const docs = useDocumentActions()
  const [params] = useSearchParams()

  const milk = settings.milk || {}
  const printer = settings.printer || {}
  const fatEnabled = milk.fat_enabled !== false
  const today = isoDate()

  const [date, setDate] = useState(today)
  const [session, setSession] = useState(() => params.get('session') || currentSession(milk.evening_starts_at))
  const [customer, setCustomer] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [fat, setFat] = useState('')
  const [manualRate, setManualRate] = useState(null) // null = automatic
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null) // { entry, offline }
  const [day, setDay] = useState({ data: [], totals: null })
  const [prices, setPrices] = useState(todayPrices)
  const [editing, setEditing] = useState(null)
  const [fieldError, setFieldError] = useState(null)

  const pickerRef = useRef(null)
  const qtyRef = useRef(null)
  const fatRef = useRef(null)
  const nextRef = useRef(null)

  // Preselect customer from ?customer=ID (e.g. "Add Milk" on a profile).
  useEffect(() => {
    const id = Number(params.get('customer'))
    if (id && !customer) {
      const c = customers.find((x) => x.id === id)
      if (c) setCustomer(c)
    }
  }, [params, customers, customer])

  // Prices: today's come with the session bundle; other dates are fetched.
  useEffect(() => {
    if (date === today) {
      setPrices(todayPrices)
      return
    }
    api.get('/milk-entries/prices', { params: { date } }).then((r) => setPrices(r.data.prices)).catch(() => {})
  }, [date, today, todayPrices])

  const loadDay = useCallback(() => {
    api.get('/milk-entries/day', { params: { date, session } })
      .then((r) => setDay({ data: r.data.data, totals: r.data.totals }))
      .catch(() => {})
  }, [date, session])

  useEffect(loadDay, [loadDay])

  // Entries saved offline for this date/session count as "already entered" too.
  const queued = useMemo(
    () => (stats.pendingRows || []).filter((r) => r.entry_date === date && r.session === session),
    [stats.pendingRows, date, session],
  )

  const existing = useMemo(() => {
    if (!customer) return null
    return day.data.find((e) => e.customer_id === customer.id) || queued.find((r) => r.customer_id === customer.id) || null
  }, [customer, day.data, queued])

  const price = prices?.[session]
  const autoRate = rateFor(price, fat)
  const rate = manualRate !== null && manualRate !== '' ? Number(manualRate) : autoRate
  const amount = quantity ? amountFor(quantity, rate) : null

  const resetForm = useCallback(() => {
    setCustomer(null)
    setQuantity('')
    setFat('')
    setManualRate(null)
    setSaved(null)
    setFieldError(null)
    setTimeout(() => pickerRef.current?.focus(), 0)
  }, [])

  const onCustomer = (c) => {
    setCustomer(c)
    setSaved(null)
    setFieldError(null)
    if (c) setTimeout(() => qtyRef.current?.focus(), 0)
  }

  const save = async () => {
    if (!customer || saving) return
    const q = Number(quantity)
    if (!q || q <= 0) {
      setFieldError(t('collection.quantity'))
      qtyRef.current?.focus()
      return
    }
    if (milk.fat_required && fatEnabled && !fat) {
      fatRef.current?.focus()
      return
    }

    const payload = {
      customer_id: customer.id,
      entry_date: date,
      session,
      quantity: q,
      fat: fatEnabled && fat !== '' ? Number(fat) : null,
      client_uuid: uuid(),
    }
    if (manualRate !== null && manualRate !== '') payload.rate = Number(manualRate)

    setSaving(true)
    try {
      const { data } = await api.post('/milk-entries', payload)
      const entry = data.data
      setSaved({ entry, offline: false })
      setDay((d) => ({ ...d, data: [entry, ...d.data.filter((e) => e.id !== entry.id)] }))
      loadDay()
      afterSave(entry)
    } catch (e) {
      if (e.offline) {
        // No internet: keep it on the phone; server dedupes by client_uuid later.
        const entry = {
          ...payload,
          rate: rate != null ? round2(rate).toFixed(2) : null,
          amount: amount != null ? amount.toFixed(2) : null,
          customer: { id: customer.id, code: customer.code, name: customer.name, mobile: customer.mobile, whatsapp: customer.whatsapp },
        }
        await enqueueEntry(tenantId, payload, { customer_name: customer.name, customer_code: customer.code })
        setSaved({ entry, offline: true })
        toast.warning(t('offline.saved_offline'))
        afterSave(entry)
      } else {
        toast.error(e.message)
        if (e.code === 'duplicate_entry') loadDay()
      }
    } finally {
      setSaving(false)
    }
  }

  const afterSave = (entry) => {
    setTimeout(() => nextRef.current?.focus(), 0)
    if (printer.auto_print && settings.whatsapp?.auto_send) docs.entry.both(entry)
    else if (printer.auto_print) docs.entry.print(entry)
    else if (settings.whatsapp?.auto_send) docs.entry.whatsapp(entry)
  }

  // Ctrl/Cmd+S saves from anywhere on the screen.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const totals = day.totals?.[session]
  const sessionOptions = [
    { value: 'morning', label: t('common.morning'), icon: Sun },
    { value: 'evening', label: t('common.evening'), icon: Moon },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      {/* Date + session */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{t('collection.title')}</h1>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => { setDate(e.target.value || today); setSaved(null) }}
          className={cn('h-11 rounded-xl border border-line bg-white px-3 text-sm font-medium shadow-xs', date !== today && 'border-amber-300 bg-amber-50 text-amber-900')}
          aria-label={t('common.date')}
        />
        <Segmented options={sessionOptions} value={session} onChange={(s) => { setSession(s); setSaved(null) }} size="lg" className="w-full sm:w-auto" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Card className="p-4 sm:p-5">
            {saved ? (
              <SavedPanel saved={saved} docs={docs} onNext={resetForm} nextRef={nextRef} t={t} />
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4">
                <CustomerPicker
                  ref={pickerRef}
                  value={customer}
                  onChange={onCustomer}
                  autoFocus
                  hint={t('collection.search_hint')}
                />

                {customer && existing && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900" role="alert">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{t('collection.already_entered', { session: t(`common.${session}`) })}</p>
                      <p className="tabular mt-0.5 text-amber-800">{litres(existing.quantity, t('common.litre'))} · {existing.amount ? money(existing.amount) : ''}</p>
                    </div>
                    {existing.id && (
                      <button type="button" onClick={() => setEditing(existing)} className="font-semibold underline">
                        {t('collection.edit_existing')}
                      </button>
                    )}
                  </div>
                )}

                {customer && customer.active === false && (
                  <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">{t('collection.inactive_customer')}</p>
                )}

                <div className={cn('grid gap-3', fatEnabled ? 'grid-cols-2' : 'grid-cols-1')}>
                  <BigField label={t('collection.quantity')} error={fieldError}>
                    <Input
                      ref={qtyRef}
                      size="lg"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={quantity}
                      disabled={!customer}
                      invalid={!!fieldError}
                      onChange={(e) => { setQuantity(e.target.value); setFieldError(null) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (fatEnabled) fatRef.current?.focus()
                          else save()
                        }
                      }}
                      className="tabular"
                    />
                  </BigField>
                  {fatEnabled && (
                    <BigField label={t('collection.fat')}>
                      <Input
                        ref={fatRef}
                        size="lg"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        value={fat}
                        disabled={!customer}
                        onChange={(e) => setFat(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            save()
                          }
                        }}
                        className="tabular"
                      />
                    </BigField>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">{t('collection.rate')}</span>
                      {price?.method === 'fat' && manualRate === null && <Badge tone="blue">{t('collection.fat_based')}</Badge>}
                    </div>
                    {milk.allow_rate_override !== false ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={manualRate ?? (autoRate != null ? autoRate.toFixed(2) : '')}
                        placeholder="—"
                        disabled={!customer}
                        onChange={(e) => setManualRate(e.target.value)}
                        className="tabular w-full bg-transparent text-xl font-bold text-slate-900 focus:outline-none"
                        aria-label={t('collection.rate')}
                      />
                    ) : (
                      <p className="tabular text-xl font-bold text-slate-900">{rate != null ? rate.toFixed(2) : '—'}</p>
                    )}
                    {manualRate !== null ? (
                      <button type="button" onClick={() => setManualRate(null)} className="text-xs font-semibold text-brand-700">
                        {t('collection.rate_manual')} · ↺ {t('collection.rate_auto')}
                      </button>
                    ) : autoRate == null ? (
                      <Link to="/settings/pricing" className="text-xs font-semibold text-rose-600">{t('collection.no_rate')}</Link>
                    ) : null}
                  </div>
                  <div className="rounded-xl bg-brand-50 px-3.5 py-2.5">
                    <span className="text-xs font-medium text-brand-700">{t('collection.amount')}</span>
                    <p className="tabular text-2xl font-bold text-brand-800">{amount != null ? money(amount) : '—'}</p>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="xl"
                  className="w-full"
                  loading={saving}
                  disabled={!customer || !quantity || customer.active === false || (rate == null && milk.allow_rate_override === false)}
                >
                  {t('collection.save_entry')}
                </Button>
                <p className="hidden text-center text-xs text-slate-400 sm:block">{t('collection.shortcut_hint')}</p>
              </form>
            )}
          </Card>
        </div>

        {/* Session summary + recent entries */}
        <Card className="flex min-w-0 flex-col">
          <div className="border-b border-line px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900">{t('collection.session_total', { session: t(`common.${session}`) })}</p>
            <p className="text-xs text-slate-500">{fmtDate(date)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Mini label={t('common.entries')} value={(totals?.entries ?? 0) + queued.length} />
              <Mini label={t('common.litres')} value={qty(totals?.quantity ?? 0)} />
              <Mini label={t('common.amount')} value={money(totals?.amount ?? 0)} />
            </div>
          </div>

          <ul className="max-h-[50vh] flex-1 divide-y divide-line overflow-y-auto lg:max-h-[calc(100vh-320px)]">
            {queued.map((r) => (
              <li key={r.client_uuid} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 min-w-9 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-xs font-bold text-slate-600">{r.display?.customer_code}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{r.display?.customer_name}</span>
                <Badge tone="amber"><CloudOff className="size-3" />{t('collection.offline_badge')}</Badge>
                <span className="tabular text-sm font-semibold">{qty(r.quantity)}</span>
              </li>
            ))}
            {day.data.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                  <span className="flex h-8 min-w-9 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-xs font-bold text-slate-600 tabular">{e.customer?.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{e.customer?.name}</span>
                    <span className="tabular block text-xs text-slate-500">
                      {e.fat ? `${t('common.fat')} ${qty(e.fat)} · ` : ''}{money(e.rate)}{t('common.per_litre')}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-sm font-semibold text-slate-900">{qty(e.quantity)} {t('common.litre')}</span>
                    <span className="tabular block text-xs text-slate-500">{money(e.amount)}</span>
                  </span>
                  <Pencil className="size-3.5 text-slate-300" aria-hidden />
                </button>
              </li>
            ))}
            {!day.data.length && !queued.length && <li className="px-4 py-8 text-center text-sm text-slate-500">{t('collection.no_entries')}</li>}
          </ul>
        </Card>
      </div>

      {editing && (
        <EntryEditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => loadDay()}
          onDeleted={() => loadDay()}
        />
      )}
    </div>
  )
}

function BigField({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={cn('text-sm font-medium', error ? 'text-rose-600' : 'text-slate-700')}>{label}</span>
      {children}
    </label>
  )
}

function Mini({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <p className="tabular truncate text-sm font-bold text-slate-900">{value}</p>
      <p className="truncate text-[11px] text-slate-500">{label}</p>
    </div>
  )
}

function SavedPanel({ saved, docs, onNext, nextRef, t }) {
  const { entry, offline } = saved
  const c = entry.customer || {}

  return (
    <div className="flex flex-col items-center text-center">
      <span className={cn('mb-3 flex size-14 items-center justify-center rounded-full', offline ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
        {offline ? <CloudOff className="size-7" /> : <CheckCircle2 className="size-8" />}
      </span>
      <p className="text-lg font-bold text-slate-900">{offline ? t('offline.saved_offline') : t('collection.saved')}</p>
      <p className="mt-1 text-sm text-slate-500">
        {c.name} ({c.code}) · {t(`common.${entry.session}`)} · {fmtDate(entry.entry_date)}
      </p>

      <div className="my-5 grid w-full grid-cols-3 divide-x divide-line rounded-2xl border border-line">
        <div className="px-2 py-3">
          <p className="text-xs text-slate-500">{t('common.milk')}</p>
          <p className="tabular text-lg font-bold">{qty(entry.quantity)} {t('common.litre')}</p>
        </div>
        <div className="px-2 py-3">
          <p className="text-xs text-slate-500">{entry.fat != null ? t('common.fat') : t('common.rate')}</p>
          <p className="tabular text-lg font-bold">{entry.fat != null ? qty(entry.fat) : money(entry.rate)}</p>
        </div>
        <div className="px-2 py-3">
          <p className="text-xs text-slate-500">{t('common.amount')}</p>
          <p className="tabular text-lg font-bold text-brand-700">{entry.amount ? money(entry.amount) : '—'}</p>
        </div>
      </div>

      <EntryActions entry={entry} actions={docs.entry} busy={docs.busy} className="w-full" />

      <Button ref={nextRef} size="xl" variant="success" className="mt-3 w-full" onClick={onNext}>
        {t('collection.next_customer')} →
      </Button>
    </div>
  )
}
