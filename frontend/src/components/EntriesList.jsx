import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Milk } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { Card, DataTable, EmptyState, ErrorState, Pagination, SessionBadge } from './ui'
import { EntryEditModal } from './EntryEditModal'
import { fmtDate, money, qty } from '../utils/format'

/** Paginated milk entries table used by Today's Entries, History and customer profile. */
export function EntriesList({ params, showCustomer = true, showDate = true, url = '/milk-entries', header }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const filterKey = JSON.stringify(params)
  useEffect(() => setPage(1), [filterKey])
  const { data, error, loading, refetch } = useApi(url, { ...params, page })

  const columns = [
    showDate && { key: 'entry_date', header: t('common.date'), render: (e) => fmtDate(e.entry_date), mobile: showCustomer ? 'subtitle' : 'title' },
    showCustomer && {
      key: 'customer', header: t('common.customer'), mobile: 'title',
      render: (e) => <span className="font-medium text-slate-900">{e.customer?.name} <span className="text-slate-400">#{e.customer?.code}</span></span>,
    },
    { key: 'session', header: t('common.session'), render: (e) => <SessionBadge session={e.session} />, mobile: 'subtitle' },
    { key: 'quantity', header: t('common.milk'), align: 'right', render: (e) => `${qty(e.quantity)} ${t('common.litre')}` },
    { key: 'fat', header: t('common.fat'), align: 'right', render: (e) => (e.fat != null ? qty(e.fat) : '–') },
    { key: 'rate', header: t('common.rate'), align: 'right', render: (e) => money(e.rate) },
    {
      key: 'amount', header: t('common.amount'), align: 'right', mobile: 'value',
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 font-semibold">
          {e.locked && <Lock className="size-3.5 text-slate-400" aria-label={t('collection.locked')} />}
          {money(e.amount)}
        </span>
      ),
    },
  ].filter(Boolean)

  return (
    <Card>
      {header}
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={loading}
          onRowClick={setEditing}
          empty={<EmptyState icon={Milk} title={t('collection.no_entries')} />}
        />
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
      {editing && <EntryEditModal entry={editing} onClose={() => setEditing(null)} onSaved={refetch} onDeleted={refetch} />}
    </Card>
  )
}
