import { round2, toNumber } from '../utils/format'

/**
 * Client-side mirror of the server pricing strategies, used for the instant
 * amount preview and for entries saved offline. The server recalculates on
 * save and is always the source of truth.
 */
export function rateFor(price, fat) {
  if (!price) return null

  if (price.method === 'fat') {
    const f = toNumber(fat)
    if (f <= 0) return price.rate != null ? toNumber(price.rate) : price.min_rate != null ? toNumber(price.min_rate) : null
    const r = round2(f * toNumber(price.fat_rate))
    return price.min_rate != null ? Math.max(r, toNumber(price.min_rate)) : r
  }

  return price.rate != null ? toNumber(price.rate) : null
}

export function amountFor(quantity, rate) {
  if (rate == null) return null
  return round2(toNumber(quantity) * toNumber(rate))
}
