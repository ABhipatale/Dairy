import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlarmClock, Building2, CheckCircle2, IndianRupee, Milk, Plus, Users, XCircle } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { Badge, Button, Card, CardHeader, ErrorState, PageHeader, Spinner, StatCard } from '../../components/ui'
import { fmtDate, int, money, qty } from '../../utils/format'

export default function AdminDashboard() {
  const { t } = useTranslation()
  const { data, error, loading, refetch } = useApi('/admin/stats')

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading && !data) return <Spinner />

  return (
    <div>
      <PageHeader title={t('admin.title')} actions={<Link to="/admin/tenants?new=1"><Button icon={Plus}>{t('admin.add_company')}</Button></Link>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Building2} label={t('admin.total_companies')} value={int(data.tenants.total)} />
        <StatCard icon={CheckCircle2} tone="green" label={t('admin.active_companies')} value={int(data.tenants.active)} />
        <StatCard icon={XCircle} tone="rose" label={t('admin.inactive_companies')} value={int(data.tenants.inactive)} />
        <StatCard icon={AlarmClock} tone="amber" label={t('admin.expiring')} value={int(data.tenants.expiring_soon)} />
        <StatCard icon={Users} tone="violet" label={t('admin.total_customers')} value={int(data.customers)} />
        <StatCard icon={Milk} label={t('admin.milk_30d')} value={`${qty(data.milk_30d)} ${t('common.litre')}`} sub={`${int(data.entries_30d)} ${t('common.entries')}`} />
        <StatCard icon={IndianRupee} tone="green" label={t('admin.revenue_30d')} value={money(data.revenue_30d)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.top_companies')} />
          <ul className="divide-y divide-line">
            {data.top_tenants.map((tn) => (
              <li key={tn.id}>
                <Link to={`/admin/tenants/${tn.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{tn.name}</span>
                  <span className="tabular text-right text-sm">
                    <span className="block font-semibold">{qty(tn.milk)} {t('common.litre')}</span>
                    <span className="block text-xs text-slate-500">{money(tn.revenue)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={t('admin.recent_companies')} />
          <ul className="divide-y divide-line">
            {data.recent_tenants.map((tn) => (
              <li key={tn.id}>
                <Link to={`/admin/tenants/${tn.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{tn.name}</span>
                    <span className="block text-xs text-slate-500">{tn.city} · {fmtDate(tn.created_at)}</span>
                  </span>
                  <Badge tone={tn.status === 'active' ? 'green' : 'red'} dot>{t(`admin.status_${tn.status}`)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
