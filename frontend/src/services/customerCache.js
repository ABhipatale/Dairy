import api from './api'
import { db, getMeta, setMeta } from './offlineDb'

/**
 * Local mirror of the tenant's customer list. Search runs entirely on-device,
 * so the entry screen responds instantly and works offline. Refreshes are
 * incremental (updated_since) after the first full load.
 */
let memory = { tenantId: null, list: [] }

export async function loadCustomers(tenantId) {
  if (memory.tenantId === tenantId && memory.list.length) return memory.list
  const all = await (await db(tenantId)).getAll('customers')
  memory = { tenantId, list: sortByCode(all) }
  return memory.list
}

export async function refreshCustomers(tenantId, { full = false } = {}) {
  const since = full ? null : await getMeta(tenantId, 'customers_synced_at')
  const { data } = await api.get('/customers/lookup', { params: since ? { updated_since: since } : {} })
  const store = await db(tenantId)
  const tx = store.transaction('customers', 'readwrite')

  if (!since) await tx.store.clear()
  for (const c of data.data) await tx.store.put(c)
  await tx.done

  await setMeta(tenantId, 'customers_synced_at', data.synced_at)
  memory = { tenantId, list: sortByCode(await store.getAll('customers')) }
  return memory.list
}

/** Put one customer into the cache right after create/update (no full reload). */
export async function upsertCachedCustomer(tenantId, c) {
  const row = {
    id: c.id, code: c.code, name: c.name, mobile: c.mobile, whatsapp: c.whatsapp,
    village: c.village, active: c.status ? c.status === 'active' : c.active,
  }
  await (await db(tenantId)).put('customers', row)
  if (memory.tenantId === tenantId) {
    memory.list = sortByCode([...memory.list.filter((x) => x.id !== row.id), row])
  }
}

/**
 * Ranking: exact code → code prefix → name/village/mobile contains.
 * Numbers typed by operators are almost always customer codes.
 */
export function searchCustomers(list, term, limit = 8) {
  const q = term.trim().toLowerCase()
  if (!q) return []

  const exact = []
  const prefix = []
  const contains = []

  for (const c of list) {
    const code = String(c.code).toLowerCase()
    if (code === q) exact.push(c)
    else if (code.startsWith(q)) prefix.push(c)
    else if (
      c.name.toLowerCase().includes(q) ||
      (c.village || '').toLowerCase().includes(q) ||
      (c.mobile || '').includes(q)
    ) contains.push(c)

    if (exact.length + prefix.length >= limit) break
  }

  return [...exact, ...prefix, ...contains].slice(0, limit)
}

function sortByCode(list) {
  return list.sort((a, b) => {
    const na = Number(a.code)
    const nb = Number(b.code)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return String(a.code).localeCompare(String(b.code))
  })
}
