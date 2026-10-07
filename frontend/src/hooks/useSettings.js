import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

/**
 * Loads tenant settings once and saves one group at a time. After a save the
 * auth session is refreshed so every screen (entry, printing) sees new values.
 */
export function useSettings() {
  const { t } = useTranslation()
  const toast = useToast()
  const { refresh } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)

  const load = useCallback(() => {
    setError(null)
    api.get('/settings').then((r) => setData(r.data)).catch(setError)
  }, [])

  useEffect(load, [load])

  const save = useCallback(async (group, values) => {
    setSaving(group)
    try {
      const { data: res } = await api.put(`/settings/${group}`, values)
      setData((d) => ({ ...d, settings: { ...d.settings, [group]: res.data } }))
      toast.success(t('settings.saved'))
      refresh().catch(() => {})
      return res.data
    } catch (e) {
      toast.error(e.message)
      throw e
    } finally {
      setSaving(null)
    }
  }, [t, toast, refresh])

  return { data, error, saving, save, reload: load, setData }
}
