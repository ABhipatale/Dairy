import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react'
import { useOffline } from '../context/OfflineContext'
import { discardQueued } from '../services/offlineQueue'
import { Button, Modal } from './ui'
import { fmtDate, qty } from '../utils/format'

/** Offline notice, pending-sync counter and review of rejected offline entries. */
export function OfflineBanner() {
  const { t } = useTranslation()
  const { online, stats, syncing, sync, tenantId } = useOffline() || {}
  const [review, setReview] = useState(false)

  if (!stats) return null
  const rejected = stats.rejected || []

  return (
    <>
      {!online && (
        <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 text-sm text-white" role="status">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{t('offline.banner')}</span>
        </div>
      )}

      {online && stats.pending > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <RefreshCw className={`size-4 shrink-0 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
          <span className="flex-1">{t(stats.pending === 1 ? 'offline.pending' : 'offline.pending_plural', { count: stats.pending })}</span>
          <button type="button" className="font-semibold underline" onClick={() => sync()} disabled={syncing}>
            {syncing ? t('offline.syncing') : t('offline.sync_now')}
          </button>
        </div>
      )}

      {rejected.length > 0 && (
        <button
          type="button"
          onClick={() => setReview(true)}
          className="flex w-full items-center gap-2 bg-rose-50 px-4 py-2 text-left text-sm text-rose-800"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{t('offline.sync_rejected', { count: rejected.length })}</span>
        </button>
      )}

      <Modal open={review} onClose={() => setReview(false)} title={t('offline.rejected_title')}>
        <ul className="divide-y divide-line">
          {rejected.map((r) => (
            <li key={r.client_uuid} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{r.display?.customer_name}</p>
                <p className="text-sm text-slate-500">
                  {fmtDate(r.entry_date)} · {t(`common.${r.session}`)} · {qty(r.quantity)} {t('common.litre')}
                </p>
                <p className="mt-1 text-sm text-rose-700">{r.error}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => discardQueued(tenantId, r.client_uuid)}>
                {t('offline.discard')}
              </Button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  )
}
