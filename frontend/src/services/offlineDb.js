import { openDB } from 'idb'

/**
 * IndexedDB stores:
 *  - customers: mirror of /customers/lookup for instant (and offline) search
 *  - queue:     milk entries saved while offline, keyed by client_uuid
 *  - meta:      misc (last sync times)
 * The DB name includes the tenant id so two dairies on one phone never mix data.
 */
const dbs = new Map()

export function db(tenantId) {
  const name = `dtico-${tenantId ?? 'none'}`
  if (!dbs.has(name)) {
    dbs.set(
      name,
      openDB(name, 1, {
        upgrade(d) {
          d.createObjectStore('customers', { keyPath: 'id' })
          const q = d.createObjectStore('queue', { keyPath: 'client_uuid' })
          q.createIndex('status', 'status')
          d.createObjectStore('meta')
        },
      }),
    )
  }
  return dbs.get(name)
}

export async function getMeta(tenantId, key) {
  return (await db(tenantId)).get('meta', key)
}

export async function setMeta(tenantId, key, value) {
  return (await db(tenantId)).put('meta', value, key)
}
