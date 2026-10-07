import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { loadCustomers, refreshCustomers } from '../services/customerCache'
import { onQueueChange, queueStats, syncQueue } from '../services/offlineQueue'

/**
 * Connectivity, the offline entry queue and the local customer list.
 * Sync runs on start, when the connection comes back, and every 2 minutes.
 */
const OfflineContext = createContext(null)

export function OfflineProvider({ children }) {
  const { tenant, isAuthenticated } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const tenantId = tenant?.id

  const [online, setOnline] = useState(navigator.onLine)
  const [stats, setStats] = useState({ pending: 0, rejected: [], pendingRows: [] })
  const [syncing, setSyncing] = useState(false)
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const sync = useCallback(async ({ silent = false } = {}) => {
    if (!tenantId || !navigator.onLine) return
    setSyncing(true)
    try {
      const res = await syncQueue(tenantId)
      if (res.synced && !silent) toast.success(t('offline.synced', { count: res.synced }))
      if (res.rejected) toast.warning(t('offline.sync_rejected', { count: res.rejected }), { duration: 8000 })
    } catch {
      /* stay queued; next trigger retries */
    } finally {
      setSyncing(false)
    }
  }, [tenantId, toast, t])

  const reloadCustomers = useCallback(async ({ full = false } = {}) => {
    if (!tenantId) return []
    try {
      const list = await refreshCustomers(tenantId, { full })
      setCustomers(list)
      return list
    } catch {
      return customers
    }
  }, [tenantId, customers])

  // Boot: local data first (instant), then network refresh + queue sync.
  useEffect(() => {
    if (!tenantId || !isAuthenticated) return
    let cancelled = false

    loadCustomers(tenantId).then((list) => !cancelled && setCustomers(list))
    queueStats(tenantId).then((s) => !cancelled && setStats(s))
    refreshCustomers(tenantId).then((list) => !cancelled && setCustomers(list)).catch(() => {})
    sync({ silent: true })

    const off = onQueueChange((s) => setStats(s))
    const timer = setInterval(() => sync({ silent: true }), 120000)

    return () => {
      cancelled = true
      off()
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isAuthenticated])

  useEffect(() => {
    if (online && tenantId) {
      sync()
      refreshCustomers(tenantId).then(setCustomers).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const value = useMemo(
    () => ({ online, stats, syncing, sync, customers, setCustomers, reloadCustomers, tenantId }),
    [online, stats, syncing, sync, customers, reloadCustomers, tenantId],
  )

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
}

export const useOffline = () => useContext(OfflineContext)
