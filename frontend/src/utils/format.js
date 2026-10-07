/**
 * Number/date formatting shared by screens, receipts and messages.
 * Amounts arrive from the API as decimal strings ("286.00").
 */
const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

let currency = 'INR'
export const setCurrency = (c) => {
  currency = c || 'INR'
}
export const currencySymbol = () => SYMBOLS[currency] ?? `${currency} `

const moneyFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qtyFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const intFmt = new Intl.NumberFormat('en-IN')
const compactFmt = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })

export const toNumber = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export function money(v, { sign = false } = {}) {
  const n = toNumber(v)
  const s = `${currencySymbol()}${moneyFmt.format(Math.abs(n))}`
  if (n < 0) return `-${s}`
  return sign && n > 0 ? `+${s}` : s
}

export const moneyCompact = (v) => `${currencySymbol()}${compactFmt.format(toNumber(v))}`
export const qty = (v) => qtyFmt.format(toNumber(v))
export const litres = (v, unit = 'L') => `${qty(v)} ${unit}`
export const int = (v) => intFmt.format(toNumber(v))

/** Round half-up to 2 dp, matching the server's bcmath rounding for previews. */
export function round2(n) {
  const x = toNumber(n)
  return Math.sign(x) * Math.round((Math.abs(x) + Number.EPSILON) * 100) / 100
}

/* ── Dates (ISO yyyy-mm-dd strings, local time) ── */
const pad = (n) => String(n).padStart(2, '0')

/* "Today" follows the dairy's time zone, not the device clock's zone. */
let timeZone = null
export const setTimeZone = (tz) => {
  timeZone = tz || null
}

/** yyyy-mm-dd. Without an argument: today in the tenant's time zone. */
export function isoDate(d) {
  if (d === undefined) {
    try {
      // en-CA formats as yyyy-mm-dd
      return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    } catch {
      d = new Date()
    }
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISO(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(iso, days) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

let dateFormat = 'DD/MM/YYYY'
export const setDateFormat = (f) => {
  dateFormat = f || 'DD/MM/YYYY'
}

export function fmtDate(iso) {
  if (!iso) return ''
  const d = parseISO(iso)
  const dd = pad(d.getDate())
  const mm = pad(d.getMonth() + 1)
  const yyyy = d.getFullYear()
  if (dateFormat === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`
  if (dateFormat === 'DD-MM-YYYY') return `${dd}-${mm}-${yyyy}`
  return `${dd}/${mm}/${yyyy}`
}

export function fmtDateShort(iso, lang = 'en') {
  if (!iso) return ''
  return parseISO(iso).toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { day: '2-digit', month: 'short' })
}

export function fmtDateTime(isoDateTime, lang = 'en') {
  if (!isoDateTime) return ''
  return new Date(isoDateTime).toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function fmtMonth(ym, lang = 'en') {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { month: 'short', year: '2-digit' })
}

/** 10-day billing periods, mirroring App\Support\BillingPeriod. */
export function billingPeriod(iso) {
  const d = parseISO(iso)
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  if (day <= 10) return { start: isoDate(new Date(y, m, 1)), end: isoDate(new Date(y, m, 10)) }
  if (day <= 20) return { start: isoDate(new Date(y, m, 11)), end: isoDate(new Date(y, m, 20)) }
  return { start: isoDate(new Date(y, m, 21)), end: isoDate(new Date(y, m + 1, 0)) }
}

export function periodLabel(p) {
  if (!p) return ''
  return `${fmtDate(p.start)} – ${fmtDate(p.end)}`
}

/** Morning before the configured evening start time (default 13:00). */
export function currentSession(eveningStartsAt = '13:00') {
  const [h, m] = String(eveningStartsAt).split(':').map(Number)
  let mins
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
    mins = Number(parts.find((p) => p.type === 'hour').value) * 60 + Number(parts.find((p) => p.type === 'minute').value)
  } catch {
    const now = new Date()
    mins = now.getHours() * 60 + now.getMinutes()
  }
  return mins >= h * 60 + (m || 0) ? 'evening' : 'morning'
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  // RFC4122 v4 fallback for older WebViews
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
