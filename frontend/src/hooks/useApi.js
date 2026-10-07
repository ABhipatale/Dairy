import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../services/api'

/**
 * GET with loading/error state. Re-fetches when url/params change; stale
 * responses from earlier params are ignored (fast typing in search boxes).
 */
export function useApi(url, params, { enabled = true, keepPrevious = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const seq = useRef(0)
  const key = JSON.stringify(params ?? {})

  const fetchData = useCallback(async () => {
    if (!enabled || !url) return
    const id = ++seq.current
    setLoading(true)
    setError(null)
    if (!keepPrevious) setData(null)

    try {
      const res = await api.get(url, { params: JSON.parse(key) })
      if (id === seq.current) setData(res.data)
    } catch (e) {
      if (id === seq.current) setError(e)
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [url, key, enabled, keepPrevious])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, error, loading, refetch: fetchData, setData }
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
