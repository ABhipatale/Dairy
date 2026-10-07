import { fmtDate, money, qty } from '../../utils/format'

/**
 * Receipt document model — renderer-agnostic.
 * Line types:
 *   { type: 'logo', src }
 *   { type: 'text', text, align?: 'left'|'center'|'right', bold?, size?: 'sm'|'md'|'lg'|'xl' }
 *   { type: 'kv', k, v, bold?, size? }            label left, value right
 *   { type: 'row', cells: [{ text, align?, w }] }  table row; w = width fraction
 *   { type: 'hr', style?: 'dashed'|'solid' }
 *   { type: 'feed', lines? }
 */

function header(tenant, printer, title) {
  const lines = []
  if (printer?.print_logo && tenant?.logo_url) lines.push({ type: 'logo', src: tenant.logo_url })
  lines.push({ type: 'text', text: (tenant?.name || '').toUpperCase(), align: 'center', bold: true, size: 'lg' })
  const contact = [tenant?.city, tenant?.mobile].filter(Boolean).join(' · ')
  if (contact) lines.push({ type: 'text', text: contact, align: 'center', size: 'sm' })
  lines.push({ type: 'hr' })
  if (title) {
    lines.push({ type: 'text', text: title, align: 'center', bold: true })
    lines.push({ type: 'hr' })
  }
  return lines
}

function footer(tenant, t) {
  return [
    { type: 'hr' },
    { type: 'text', text: tenant?.thank_you_message || t('print.thank_you'), align: 'center' },
    { type: 'feed', lines: 3 },
  ]
}

/** Daily milk entry receipt. */
export function buildEntryReceipt({ entry, customer, tenant, printer, t }) {
  const c = customer || entry.customer || {}
  const L = t('common.litre')

  const lines = [
    ...header(tenant, printer, t('print.receipt_title')),
    { type: 'text', text: t('common.customer'), size: 'sm' },
    { type: 'text', text: `${c.name || ''}${c.code ? ` (${c.code})` : ''}`, bold: true, size: 'md' },
  ]

  if (printer?.print_customer_mobile && c.mobile) {
    lines.push({ type: 'text', text: `${t('print.mobile')}: ${c.mobile}`, size: 'sm' })
  }

  lines.push(
    { type: 'feed', lines: 1 },
    { type: 'kv', k: t('common.date'), v: fmtDate(entry.entry_date) },
    { type: 'kv', k: t('common.session'), v: t(`common.${entry.session}`) },
    { type: 'hr', style: 'dashed' },
    { type: 'kv', k: t('common.milk'), v: `${qty(entry.quantity)} ${L}` },
  )

  if (entry.fat != null && entry.fat !== '') lines.push({ type: 'kv', k: t('common.fat'), v: qty(entry.fat) })

  lines.push(
    { type: 'kv', k: t('common.rate'), v: `${money(entry.rate)}/${L}` },
    { type: 'hr', style: 'dashed' },
    { type: 'kv', k: t('common.amount'), v: money(entry.amount), bold: true, size: 'lg' },
    ...footer(tenant, t),
  )

  return { kind: 'entry_receipt', lines }
}

/** Compact 10-day bill for thermal paper: one row per day (M / E / amount). */
export function buildBillReceipt({ bill, tenant, printer, t }) {
  const c = bill.customer || {}
  const L = t('common.litre')
  const byDate = new Map()

  for (const it of bill.items || []) {
    const row = byDate.get(it.entry_date) || { m: null, e: null, amount: 0 }
    row[it.session === 'morning' ? 'm' : 'e'] = it.quantity
    row.amount += parseFloat(it.amount)
    byDate.set(it.entry_date, row)
  }

  const lines = [
    ...header(tenant, printer, t('print.bill_title')),
    { type: 'kv', k: t('billing.bill_no'), v: bill.bill_no, bold: true },
    { type: 'kv', k: t('billing.period'), v: `${fmtDate(bill.period_start).slice(0, 5)}–${fmtDate(bill.period_end).slice(0, 5)}` },
    { type: 'text', text: `${c.name || ''}${c.code ? ` (${c.code})` : ''}`, bold: true },
  ]

  if (printer?.print_customer_mobile && c.mobile) {
    lines.push({ type: 'text', text: `${t('print.mobile')}: ${c.mobile}`, size: 'sm' })
  }

  lines.push(
    { type: 'hr' },
    {
      type: 'row', bold: true, size: 'sm', cells: [
        { text: t('common.date'), w: 0.22 },
        { text: t('common.morning').slice(0, 4), align: 'right', w: 0.22 },
        { text: t('common.evening').slice(0, 4), align: 'right', w: 0.22 },
        { text: t('common.amount'), align: 'right', w: 0.34 },
      ],
    },
    { type: 'hr', style: 'dashed' },
  )

  for (const [date, r] of byDate) {
    lines.push({
      type: 'row', size: 'sm', cells: [
        { text: fmtDate(date).slice(0, 5), w: 0.22 },
        { text: r.m != null ? qty(r.m) : '-', align: 'right', w: 0.22 },
        { text: r.e != null ? qty(r.e) : '-', align: 'right', w: 0.22 },
        { text: qty(r.amount), align: 'right', w: 0.34 },
      ],
    })
  }

  lines.push(
    { type: 'hr' },
    { type: 'kv', k: t('billing.total_milk'), v: `${qty(bill.total_qty)} ${L}` },
    { type: 'kv', k: t('billing.total_amount'), v: money(bill.total_amount) },
  )

  if (parseFloat(bill.previous_balance) !== 0) lines.push({ type: 'kv', k: t('billing.previous_balance'), v: money(bill.previous_balance) })
  if (parseFloat(bill.discount) > 0) lines.push({ type: 'kv', k: t('billing.discount'), v: `-${money(bill.discount)}` })

  lines.push(
    { type: 'kv', k: t('billing.net_payable'), v: money(bill.net_payable), bold: true },
    // The slip is handed to the customer, so it speaks from their side.
    { type: 'kv', k: t('print.paid_to_you'), v: money(bill.paid_amount) },
    { type: 'kv', k: t('print.balance_to_receive'), v: money(bill.outstanding), bold: true, size: 'lg' },
    ...footer(tenant, t),
  )

  return { kind: 'bill', lines }
}

export function buildTestReceipt({ tenant, printer, t }) {
  return {
    kind: 'test',
    lines: [
      ...header(tenant, printer, t('print.test_print')),
      { type: 'text', text: 'English · मराठी · हिंदी', align: 'center' },
      { type: 'kv', k: t('common.milk'), v: `5.50 ${t('common.litre')}` },
      { type: 'kv', k: t('common.amount'), v: money(286), bold: true, size: 'lg' },
      { type: 'text', text: new Date().toLocaleString(), align: 'center', size: 'sm' },
      ...footer(tenant, t),
    ],
  }
}
