import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { buildBillReceipt, buildEntryReceipt } from '../services/print/receipt'
import { printDocument } from '../services/print/printService'
import { sendWhatsApp, waLink } from '../services/whatsapp'
import { fmtDate, money, qty } from '../utils/format'

/**
 * Print / WhatsApp / Print+WhatsApp for milk entries and bills, with
 * busy state and friendly errors. Shared by the entry screen, lists and bill page.
 */
export function useDocumentActions() {
  const { t } = useTranslation()
  const { tenant, settings } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(null) // 'print' | 'whatsapp' | 'both' | null
  const printer = useMemo(() => settings.printer || {}, [settings.printer])

  const printErr = useCallback((e) => {
    toast.error(e?.code === 'unsupported' ? t('print.unsupported') : t('print.failed'))
  }, [t, toast])

  const doPrint = useCallback(async (doc, referenceId) => {
    try {
      await printDocument(doc, printer, { referenceId })
      return true
    } catch (e) {
      if (e?.code !== 'cancelled') printErr(e)
      return false
    }
  }, [printer, printErr])

  /** Local message used when the phone is offline (mirrors the server template). */
  const offlineEntryMessage = useCallback((entry) => {
    const c = entry.customer || {}
    const L = t('common.litre')
    return [
      `🥛 *${(tenant?.name || '').toUpperCase()}*`, '',
      `*${t('print.receipt_title')}*`, '',
      `${t('common.customer')}: ${c.name} (${c.code})`,
      `${t('common.date')}: ${fmtDate(entry.entry_date)}`,
      `${t('common.session')}: ${t(`common.${entry.session}`)}`, '',
      `${t('common.milk')}: ${qty(entry.quantity)} ${L}`,
      entry.fat != null && entry.fat !== '' ? `${t('common.fat')}: ${qty(entry.fat)}` : null,
      `${t('common.rate')}: ${money(entry.rate)}/${L}`, '',
      `*${t('common.amount')}: ${money(entry.amount)}*`, '',
      tenant?.thank_you_message || t('print.thank_you'),
    ].filter((l) => l !== null).join('\n')
  }, [t, tenant])

  const whatsappEntry = useCallback(async (entry) => {
    const phone = entry.customer?.whatsapp || entry.customer?.mobile
    if (!phone) {
      toast.error(t('whatsapp.no_phone'))
      return false
    }

    // Offline-queued entries have no server id yet.
    if (!entry.id) {
      window.open(waLink(phone, offlineEntryMessage(entry), settings.whatsapp?.country_code), '_blank')
      return true
    }

    try {
      await sendWhatsApp(`/milk-entries/${entry.id}/whatsapp`, { offlineMessage: offlineEntryMessage(entry), offlinePhone: phone, countryCode: settings.whatsapp?.country_code })
      return true
    } catch (e) {
      toast.error(e.message || t('whatsapp.failed'))
      return false
    }
  }, [t, toast, offlineEntryMessage, settings.whatsapp])

  const run = useCallback(async (kind, fn) => {
    setBusy(kind)
    try {
      return await fn()
    } finally {
      setBusy(null)
    }
  }, [])

  const entry = {
    print: (e) => run('print', () => doPrint(buildEntryReceipt({ entry: e, tenant, printer, t }), e.id)),
    whatsapp: (e) => run('whatsapp', () => whatsappEntry(e)),
    both: (e) => run('both', async () => {
      // Open WhatsApp first: it must happen inside the tap (popup rules); print follows.
      const wa = whatsappEntry(e)
      await doPrint(buildEntryReceipt({ entry: e, tenant, printer, t }), e.id)
      await wa
    }),
  }

  const bill = {
    print: (b) => run('print', () => doPrint(buildBillReceipt({ bill: b, tenant, printer, t }), b.id)),
    whatsapp: (b, onSent) => run('whatsapp', async () => {
      try {
        await sendWhatsApp(`/bills/${b.id}/whatsapp`)
        onSent?.()
      } catch (e) {
        toast.error(e.message || t('whatsapp.failed'))
      }
    }),
  }

  return { busy, entry, bill, printer }
}
