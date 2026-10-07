import axios from 'axios'
import i18n from '../i18n'
import { storage } from '../utils/storage'

/**
 * Single API client. Adds the bearer token and UI language, and turns every failure
 * into an ApiError with a human message (never raw server/SQL text).
 */
export class ApiError extends Error {
  constructor({ message, code, status, errors, context, offline = false }) {
    super(message)
    this.code = code
    this.status = status
    this.errors = errors || {}
    this.context = context || {}
    this.offline = offline
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 20000,
  headers: { Accept: 'application/json' },
})

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

api.interceptors.request.use((config) => {
  const token = storage.get('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['X-Locale'] = i18n.language
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (!error.response) {
      const timeout = error.code === 'ECONNABORTED'
      throw new ApiError({
        message: i18n.t(timeout ? 'errors.timeout' : 'errors.network'),
        code: timeout ? 'timeout' : 'network',
        status: 0,
        offline: !timeout,
      })
    }

    const { status, data } = error.response
    let body = data

    // Blob responses (PDF downloads) carry JSON errors as Blob.
    if (body instanceof Blob) {
      try {
        body = JSON.parse(await body.text())
      } catch {
        body = {}
      }
    }

    if (status === 401 && !error.config?.url?.includes('auth/login')) onUnauthorized()

    throw new ApiError({
      message: body?.message || i18n.t('errors.generic'),
      code: body?.code || 'error',
      status,
      errors: body?.errors,
      context: body?.context,
    })
  },
)

/** Fetch a binary (PDF/XLSX) and either open it or save it. */
export async function downloadFile(url, params, filename, { open = false } = {}) {
  const res = await api.get(url, { params, responseType: 'blob', timeout: 60000 })
  const blob = res.data
  const href = URL.createObjectURL(blob)

  if (open) {
    const w = window.open(href, '_blank')
    if (!w) triggerDownload(href, filename)
  } else {
    triggerDownload(href, filename)
  }

  setTimeout(() => URL.revokeObjectURL(href), 60000)
  return blob
}

function triggerDownload(href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default api
