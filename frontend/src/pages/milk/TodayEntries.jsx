import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useApi, useDebounce } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { EntriesList } from '../../components/EntriesList'
import { Button, PageHeader, SearchInput, Segmented, StatCard } from '../../components/ui'
import { fmtDate, isoDate, money, qty } from '../../utils/format'
import { Moon, Sun } from 'lucide-react'

export default function TodayEntries() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const [date, setDate] = useState(isoDate())
  const [session, setSession] = useState('')
  const [search, setSearch] = useState('')
  const term = useDebounce(search)
  const { data: day } = useApi('/milk-entries/day', { date })

  const totals = day?.totals
  const sum = (k) => (Number(totals?.morning?.[k] || 0) + Number(totals?.evening?.[k] || 0))

  return (
    <div>
      <PageHeader
        title={t('collection.today_entries')}
        subtitle={fmtDate(date)}
        actions={can('milk.create') && (
          <Link to="/collection"><Button icon={Plus}>{t('nav.add_milk')}</Button></Link>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Sun} tone="amber" label={t('dashboard.morning_milk')} value={`${qty(totals?.morning?.quantity)} ${t('common.litre')}`} sub={money(totals?.morning?.amount)} />
        <StatCard icon={Moon} tone="violet" label={t('dashboard.evening_milk')} value={`${qty(totals?.evening?.quantity)} ${t('common.litre')}`} sub={money(totals?.evening?.amount)} />
        <StatCard label={t('common.total')} value={`${qty(sum('quantity'))} ${t('common.litre')}`} sub={t('dashboard.entries', { count: sum('entries') })} />
        <StatCard tone="green" label={t('common.amount')} value={money(sum('amount'))} />
      </div>

      <EntriesList
        params={{ date, session: session || undefined, search: term || undefined, per_page: 50 }}
        header={
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder={t('customers.search_placeholder')} className="flex-1" />
            <input
              type="date"
              value={date}
              max={isoDate()}
              onChange={(e) => setDate(e.target.value || isoDate())}
              className="h-11 rounded-xl border border-line bg-white px-3 text-sm"
              aria-label={t('common.date')}
            />
            <Segmented
              value={session}
              onChange={setSession}
              options={[
                { value: '', label: t('common.all') },
                { value: 'morning', label: t('common.morning') },
                { value: 'evening', label: t('common.evening') },
              ]}
            />
          </div>
        }
      />
    </div>
  )
}
