import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { setUnauthorizedHandler } from '../services/api'
import { setLanguage } from '../i18n'
import { storage } from '../utils/storage'
import { setCurrency, setDateFormat, setTimeZone } from '../utils/format'

/**
 * Session = everything returned by /auth/login and /auth/me (user, permissions,
 * tenant branding, settings, today's prices). It is cached in localStorage so the
 * PWA can boot and take milk entries without network.
 */
const AuthContext = createContext(null)

function applySession(session) {
  if (!session) return
  setCurrency(session.tenant?.currency)
  setDateFormat(session.settings?.general?.date_format)
  setTimeZone(session.tenant?.timezone)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const cached = storage.get('session')
    applySession(cached)
    return cached
  })
  const [booting, setBooting] = useState(!!storage.get('token'))

  const save = useCallback((data, { initLanguage = false } = {}) => {
    const { token, ...rest } = data
    if (token) storage.set('token', token)
    storage.set('session', rest)
    applySession(rest)
    setSession(rest)

    if (initLanguage) {
      const lang = rest.user?.language || rest.tenant?.default_language
      if (lang) setLanguage(lang)
    }
  }, [])

  const clear = useCallback(() => {
    storage.remove('token')
    storage.remove('session')
    setSession(null)
  }, [])

  const refresh = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    save(data)
    return data
  }, [save])

  useEffect(() => {
    setUnauthorizedHandler(clear)
  }, [clear])

  // Revalidate the cached session on start; keep it if we're offline.
  useEffect(() => {
    if (!storage.get('token')) return
    refresh()
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [refresh])

  const login = useCallback(async (login, password) => {
    const { data } = await api.post('/auth/login', { login, password, device_name: navigator.userAgent.slice(0, 90) })
    save(data, { initLanguage: true })
    return data
  }, [save])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* token may already be invalid */
    }
    clear()
  }, [clear])

  const value = useMemo(() => {
    const perms = new Set(session?.permissions || [])
    const can = (p) => perms.has('*') || perms.has(p)

    return {
      session,
      user: session?.user,
      tenant: session?.tenant,
      settings: session?.settings || {},
      prices: session?.prices || {},
      isSuperAdmin: !!session?.is_super_admin,
      isAuthenticated: !!session && !!storage.get('token'),
      booting,
      can,
      login,
      logout,
      refresh,
      updateSession: (patch) => save({ ...session, ...patch }),
    }
  }, [session, booting, login, logout, refresh, save])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
