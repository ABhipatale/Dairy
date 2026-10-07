import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarRange, Clock, FileText, IndianRupee, Milk, Moon, Plus, Sun, UserPlus, Users, Wallet } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { Button, ErrorState, Skeleton, StatCard } from '../components/ui'
import { ChartCard, SERIES, SimpleBars, StackedBars, TrendArea } from '../components/charts'
import { fmtDate, fmtDateShort, fmtMonth, int, money, moneyCompact, periodLabel, qty } from '../utils/format'

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const { can, user } = useAuth()
  const navigate = useNavigate()
  const { data, error, loading, refetch } = useApi('/dashboard')
  const L = t('common.litre')

  if (error) return <ErrorState error={error} onRetry={refetch} />

  const d = data
  const lang = i18n.language

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{d ? fmtDate(d.date) : ''}</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{t('dashboard.title')}</h1>
        </div>
        <span className="hidden text-sm text-slate-500 sm:block">{user?.name}</span>
      </div>

      {/* Quick actions — the most important tasks are always one tap away */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {can('milk.create') && <QuickAction to="/collection" icon={Milk} label={t('nav.add_milk')} primary />}
        {can('customers.manage') && <QuickAction to="/customers/new" icon={UserPlus} label={t('nav.add_customer')} />}
        {can('bills.manage') && <QuickAction to="/bills/new" icon={FileText} label={t('dashboard.generate_bill')} />}
        {can('payments.manage') && <QuickAction to="/payments" icon={Wallet} label={t('dashboard.receive_payment')} />}
      </div>

      {/* KPIs */}
      {!d && loading ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-(--radius-card)" />)}
        </div>
      ) : d && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Milk} label={t('dashboard.today_milk')} value={`${qty(d.today.milk)} ${L}`} />
          <StatCard icon={IndianRupee} tone="green" label={t('dashboard.today_revenue')} value={money(d.today.revenue)} />
          <StatCard icon={Sun} tone="amber" label={t('dashboard.morning_milk')} value={`${qty(d.today.morning.quantity)} ${L}`} sub={t('dashboard.entries', { count: d.today.morning.entries })} />
          <StatCard icon={Moon} tone="violet" label={t('dashboard.evening_milk')} value={`${qty(d.today.evening.quantity)} ${L}`} sub={t('dashboard.entries', { count: d.today.evening.entries })} />
          <StatCard icon={Users} label={t('dashboard.today_customers')} value={`${int(d.today.customers)} / ${int(d.active_customers)}`} />
          <StatCard
            icon={Clock}
            tone="rose"
            label={t('dashboard.pending_payments')}
            value={money(d.pending_payments)}
            sub={t('dashboard.open_bills', { count: d.open_bills })}
            onClick={can('bills.view') ? () => navigate('/bills?status=open') : undefined}
          />
          <StatCard icon={CalendarRange} tone="violet" label={t('dashboard.period_bills')} value={int(d.period.bills)} sub={periodLabel(d.period)} />
          <StatCard icon={IndianRupee} tone="green" label={t('dashboard.month_revenue')} value={money(d.month_revenue)} />
        </div>
      )}

      {d?.customers_to_bill > 0 && can('bills.manage') && (
        <Link to="/bills" className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <FileText className="size-5 shrink-0 text-brand-600" />
          <span className="flex-1 font-medium">{t('dashboard.to_bill', { count: d.customers_to_bill })}</span>
          <span className="flex items-center gap-1 font-semibold text-brand-700">{t('dashboard.to_bill_action')} <ArrowRight className="size-4" /></span>
        </Link>
      )}

      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={t('dashboard.collection_trend')} subtitle={t('dashboard.morning_vs_evening')}>
            <StackedBars
              data={d.trend}
              xKey="date"
              xFormat={(v) => fmtDateShort(v, lang)}
              format={(v) => `${qty(v)} ${L}`}
              series={[
                { key: 'morning', name: t('common.morning'), color: SERIES.s1 },
                { key: 'evening', name: t('common.evening'), color: SERIES.s2 },
              ]}
            />
          </ChartCard>
          <ChartCard title={t('dashboard.revenue_trend')}>
            <TrendArea data={d.trend} xKey="date" yKey="amount" name={t('common.amount')} xFormat={(v) => fmtDateShort(v, lang)} format={money} />
          </ChartCard>
          <ChartCard title={t('dashboard.monthly_performance')} subtitle={t('common.amount')}>
            <SimpleBars data={d.monthly} xKey="month" yKey="amount" name={t('common.amount')} xFormat={(v) => fmtMonth(v, lang)} format={moneyCompact} />
          </ChartCard>
          <ChartCard title={t('dashboard.monthly_performance')} subtitle={t('common.litres')}>
            <SimpleBars data={d.monthly} xKey="month" yKey="quantity" name={t('common.milk')} xFormat={(v) => fmtMonth(v, lang)} format={(v) => `${qty(v)} ${L}`} />
          </ChartCard>
        </div>
      )}
    </div>
  )
}

function QuickAction({ to, icon: Icon, label, primary }) {
  return (
    <Link to={to}>
      <Button variant={primary ? 'primary' : 'secondary'} size="lg" icon={primary ? Plus : Icon} className="w-full justify-start">
        <span className="truncate">{label}</span>
      </Button>
    </Link>
  )
}
