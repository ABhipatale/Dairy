import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart3, ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Printer } from 'lucide-react'
import { downloadFile } from '../../services/api'
import { useApi } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { CustomerPicker } from '../../components/CustomerPicker'
import { ChartCard, SERIES, SimpleBars, StackedBars } from '../../components/charts'
import {
  BillStatusBadge, Button, Card, DataTable, EmptyState, ErrorState, Field, PageHeader, Pagination, Segmented, Select, StatCard,
} from '../../components/ui'
import { addDays, billingPeriod, isoDate, money, periodLabel, qty } from '../../utils/format'

const TYPES = ['daily', 'ten_day', 'monthly', 'yearly']
const MONEY_KEYS = /revenue|paid|outstanding|pending/

export default function Reports() {
  const { t } = useTranslation()
  const { type = 'daily' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const today = isoDate()

  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [periodDate, setPeriodDate] = useState(addDays(billingPeriod(today).start, -1))
  const [month, setMonth] = useState(today.slice(0, 7))
  const [year, setYear] = useState(Number(today.slice(0, 4)))
  const [customer, setCustomer] = useState(null)
  const [session, setSession] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(null)

  const params = useMemo(() => {
    const base = { customer_id: customer?.id, session: session || undefined }
    if (type === 'daily') return { ...base, date_from: dateFrom, date_to: dateTo || dateFrom }
    if (type === 'ten_day') return { ...base, date_from: periodDate, payment_status: status || undefined }
    if (type === 'monthly') return { ...base, month }
    return { ...base, year }
  }, [type, customer, session, dateFrom, dateTo, periodDate, status, month, year])

  useEffect(() => setPage(1), [params])

  const valid = TYPES.includes(type)
  const { data, error, loading, refetch } = useApi(valid ? `/reports/${type}` : null, { ...params, page }, { enabled: valid })

  if (!valid) return <ErrorState error={{ message: t('errors.not_found_title') }} />

  const rows = Array.isArray(data?.rows) ? data.rows : data?.rows?.data
  const meta = Array.isArray(data?.rows) ? null : data?.rows?.meta ?? (data?.rows?.last_page ? data.rows : null)

  const exportAs = async (format, open = false) => {
    setExporting(format + open)
    try {
      await downloadFile(`/reports/${type}/export`, { ...params, format }, `${type}-report.${format}`, { open })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setExporting(null)
    }
  }

  const fmtCell = (col, row) => {
    const v = row[col.key]
    if (col.type === 'money') return money(v)
    if (col.type === 'qty') return v == null ? '–' : qty(v)
    if (col.type === 'status') return <BillStatusBadge status={v} />
    return v ?? '–'
  }

  const columns = (data?.columns || []).map((col, i) => ({
    key: col.key,
    header: col.label,
    align: col.align,
    render: (row) => fmtCell(col, row),
    mobile: i === 0 && type !== 'daily' && type !== 'ten_day' ? 'title' : col.key === 'name' ? 'title' : col.key === 'code' ? 'hide' : col.key === 'amount' ? 'value' : undefined,
  }))

  const summaryTiles = Object.entries(data?.summary || {}).map(([k, v]) => ({
    k,
    label: t(`reports.summary.${k}`),
    value: MONEY_KEYS.test(k) ? money(v) : k.includes('milk') ? `${qty(v)} ${t('common.litre')}` : v,
  }))

  const shiftPeriod = (dir) => {
    const p = billingPeriod(periodDate)
    setPeriodDate(dir < 0 ? addDays(p.start, -1) : addDays(p.end, 1))
  }

  return (
    <div>
      <PageHeader
        title={t(`reports.${type}`)}
        subtitle={data?.subtitle}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => exportAs('pdf', true)} loading={exporting === 'pdftrue'}>{t('common.print')}</Button>
            <Button variant="secondary" icon={FileDown} onClick={() => exportAs('pdf')} loading={exporting === 'pdffalse'}>{t('common.export_pdf')}</Button>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => exportAs('xlsx')} loading={exporting === 'xlsxfalse'}>{t('common.export_excel')}</Button>
          </>
        }
      />

      <Segmented
        value={type}
        onChange={(v) => navigate(`/reports/${v}`)}
        className="mb-4 w-full overflow-x-auto sm:w-auto"
        options={TYPES.map((v) => ({ value: v, label: t(`nav.${v}`) }))}
      />

      {/* Filters: one row above the content */}
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {type === 'daily' && (
          <>
            <Field label={t('common.from')}>{({ id }) => <input id={id} type="date" max={today} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" />}</Field>
            <Field label={t('common.to')}>{({ id }) => <input id={id} type="date" max={today} min={dateFrom} value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" />}</Field>
          </>
        )}
        {type === 'ten_day' && (
          <>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('billing.period')}</span>
              <div className="flex h-11 items-center rounded-xl border border-line bg-white">
                <button type="button" onClick={() => shiftPeriod(-1)} className="px-3 text-slate-500" aria-label={t('billing.prev_period')}><ChevronLeft className="size-4" /></button>
                <span className="tabular flex-1 text-center text-sm font-semibold">{periodLabel(billingPeriod(periodDate))}</span>
                <button type="button" onClick={() => shiftPeriod(1)} className="px-3 text-slate-500" aria-label={t('billing.next_period')}><ChevronRight className="size-4" /></button>
              </div>
            </div>
            <Field label={t('reports.payment_status')}>
              {({ id }) => (
                <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">{t('common.all')}</option>
                  {['unbilled', 'generated', 'pending', 'partially_paid', 'paid'].map((s) => <option key={s} value={s}>{t(`billing.status.${s}`)}</option>)}
                </Select>
              )}
            </Field>
          </>
        )}
        {type === 'monthly' && (
          <Field label={t('reports.month')}>{({ id }) => <input id={id} type="month" max={today.slice(0, 7)} value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" />}</Field>
        )}
        {type === 'yearly' && (
          <Field label={t('reports.year')}>
            {({ id }) => (
              <Select id={id} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {Array.from({ length: 6 }, (_, i) => Number(today.slice(0, 4)) - i).map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            )}
          </Field>
        )}
        <div className={type === 'ten_day' ? '' : 'sm:col-span-1 lg:col-span-1'}>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('common.customer')}</span>
          <CustomerPicker value={customer} onChange={setCustomer} size="md" includeInactive placeholder={t('reports.all_customers')} />
        </div>
        {type !== 'ten_day' && type !== 'yearly' && (
          <Field label={t('common.session')}>
            {({ id }) => (
              <Select id={id} value={session} onChange={(e) => setSession(e.target.value)}>
                <option value="">{t('reports.all_sessions')}</option>
                <option value="morning">{t('common.morning')}</option>
                <option value="evening">{t('common.evening')}</option>
              </Select>
            )}
          </Field>
        )}
      </Card>

      {error ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          {summaryTiles.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {summaryTiles.map((s) => <StatCard key={s.k} label={s.label} value={s.value} />)}
            </div>
          )}

          {type === 'monthly' && data?.chart?.length > 0 && (
            <div className="mb-4">
              <ChartCard title={t('reports.chart_daily')} subtitle={t('dashboard.morning_vs_evening')}>
                <StackedBars
                  data={data.chart}
                  xKey="label"
                  format={(v) => `${qty(v)} ${t('common.litre')}`}
                  series={[
                    { key: 'morning', name: t('common.morning'), color: SERIES.s1 },
                    { key: 'evening', name: t('common.evening'), color: SERIES.s2 },
                  ]}
                />
              </ChartCard>
            </div>
          )}

          {type === 'yearly' && data?.chart && (
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <ChartCard title={t('reports.chart_monthly')} subtitle={t('common.litres')}>
                <SimpleBars data={data.chart} xKey="label" yKey="milk" name={t('common.milk')} format={(v) => `${qty(v)} ${t('common.litre')}`} />
              </ChartCard>
              <ChartCard title={t('reports.chart_monthly')} subtitle={t('common.amount')}>
                <SimpleBars data={data.chart} xKey="label" yKey="amount" name={t('common.amount')} format={money} />
              </ChartCard>
            </div>
          )}

          <Card>
            <DataTable
              rowKey={type === 'daily' || type === 'ten_day' ? 'customer_id' : columns[0]?.key || 'label'}
              columns={columns}
              rows={rows}
              loading={loading}
              onRowClick={(r) => r.customer_id && navigate(`/customers/${r.customer_id}`)}
              empty={<EmptyState icon={BarChart3} title={t('reports.no_data')} text={data?.subtitle} />}
            />
            {meta && <Pagination meta={meta} onPage={setPage} />}
          </Card>
        </>
      )}
    </div>
  )
}
