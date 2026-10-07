import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { Card, EmptyState, ErrorState, Pagination, Select, SkeletonRows } from './ui'
import { fmtDateTime } from '../utils/format'

const ENTITIES = ['customer', 'milk_entry', 'milk_price', 'bill', 'payment', 'user', 'tenant', 'settings']

/** Who changed what, when and from where (super admin). */
export function AuditTable({ url, extraParams }) {
  const { t, i18n } = useTranslation()
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const { data, error, loading, refetch } = useApi(url, { entity_type: entity || undefined, page, ...extraParams })

  return (
    <Card>
      <div className="border-b border-line p-4">
        <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} className="sm:w-64" aria-label="Entity">
          <option value="">{t('common.all')}</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
        </Select>
      </div>
      {error ? <ErrorState error={error} onRetry={refetch} /> : loading && !data ? <SkeletonRows /> : (
        <ul className="divide-y divide-line">
          {data?.data?.map((log) => (
            <li key={log.id}>
              <button type="button" onClick={() => setOpen(open === log.id ? null : log.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-semibold text-slate-800">{log.action}{log.entity_id ? ` #${log.entity_id}` : ''}</span>
                  <span className="block text-xs text-slate-500">{log.user?.name || 'system'} · {fmtDateTime(log.created_at, i18n.language)} · {log.ip_address || '–'}</span>
                </span>
              </button>
              {open === log.id && (
                <div className="grid gap-3 bg-slate-50 px-4 py-3 text-xs sm:grid-cols-2">
                  {['old_values', 'new_values'].map((k) => log[k] && (
                    <pre key={k} className="overflow-x-auto rounded-lg bg-white p-3 text-slate-700 ring-1 ring-line">{JSON.stringify(log[k], null, 2)}</pre>
                  ))}
                </div>
              )}
            </li>
          ))}
          {data && !data.data.length && <EmptyState icon={History} title={t('common.no_results')} />}
        </ul>
      )}
      <Pagination meta={data} onPage={setPage} />
    </Card>
  )
}
