import api from './api'
import { db } from './offlineDb'

/**
 * Milk entries saved without internet. Each carries a client_uuid; the server
 * treats a repeated uuid as the same entry, so syncing twice (flaky network,
 * two tabs, app killed mid-sync) can never create duplicates.
 *
 * status: pending → (synced: removed) | rejected (kept for the operator to review)
 */
const listeners = new Set()
let syncing = false

export function onQueueChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function notify(tenantId) {
  const stats = await queueStats(tenantId)
  listeners.forEach((fn) => fn(stats))
}

export async function enqueueEntry(tenantId, payload, display) {
  const row = { ...payload, status: 'pending', display, queued_at: new Date().toISOString() }
  await (await db(tenantId)).put('queue', row)
  await notify(tenantId)
  return row
}

export async function queueStats(tenantId) {
  const all = await (await db(tenantId)).getAll('queue')
  return {
    pending: all.filter((r) => r.status === 'pending').length,
    rejected: all.filter((r) => r.status === 'rejected'),
    pendingRows: all.filter((r) => r.status === 'pending'),
  }
}

export async function discardQueued(tenantId, clientUuid) {
  await (await db(tenantId)).delete('queue', clientUuid)
  await notify(tenantId)
}

/** Push pending entries in batches. Returns { synced, rejected } counts. */
export async function syncQueue(tenantId) {
  if (syncing || !tenantId) return { synced: 0, rejected: 0 }
  syncing = true

  try {
    const store = await db(tenantId)
    const pending = (await store.getAll('queue')).filter((r) => r.status === 'pending')
    let synced = 0
    let rejected = 0

    for (let i = 0; i < pending.length; i += 50) {
      const batch = pending.slice(i, i + 50)
      const entries = batch.map((row) => {
        const payload = { ...row }
        for (const local of ['status', 'display', 'queued_at', 'error', 'code']) delete payload[local]
        return payload
      })

      const { data } = await api.post('/milk-entries/sync', { entries }, { timeout: 45000 })

      for (const result of data.results) {
        const row = batch.find((r) => r.client_uuid === result.client_uuid)
        if (!row) continue

        if (result.status === 'created' || result.status === 'duplicate_replay') {
          await store.delete('queue', row.client_uuid)
          synced++
        } else {
          await store.put('queue', { ...row, status: 'rejected', error: result.message, code: result.code })
          rejected++
        }
      }
    }

    await notify(tenantId)
    return { synced, rejected }
  } finally {
    syncing = false
  }
}
