import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Trash2 } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, ConfirmDialog, Field, Input, Modal, SessionBadge } from './ui'
import { EntryActions } from './EntryActions'
import { useDocumentActions } from '../hooks/useDocumentActions'
import { fmtDate, money } from '../utils/format'

/** View / edit / delete a saved milk entry, with print & WhatsApp. */
export function EntryEditModal({ entry, onClose, onSaved, onDeleted }) {
  const { t } = useTranslation()
  const { can, settings } = useAuth()
  const toast = useToast()
  const docs = useDocumentActions()
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (entry) setForm({ quantity: entry.quantity, fat: entry.fat ?? '', rate: entry.rate, notes: entry.notes ?? '' })
    setErrors({})
  }, [entry])

  if (!entry) return null

  const editable = !entry.locked && can('milk.update')
  const milk = settings.milk || {}

  const save = async () => {
    setSaving(true)
    setErrors({})
    try {
      const payload = { quantity: form.quantity, fat: form.fat === '' ? null : form.fat, notes: form.notes || null }
      if (String(form.rate) !== String(entry.rate)) payload.rate = form.rate
      const { data } = await api.put(`/milk-entries/${entry.id}`, payload)
      toast.success(t('collection.updated'))
      onSaved?.(data.data)
      onClose()
    } catch (e) {
      setErrors(e.errors || {})
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/milk-entries/${entry.id}`)
      toast.success(t('collection.deleted'))
      onDeleted?.(entry)
      onClose()
    } catch (e) {
      toast.error(e.message)
      throw e
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={t('collection.edit_entry')}
        footer={editable && (
          <>
            {can('milk.delete') && (
              <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirm(true)} className="sm:mr-auto">
                {t('common.delete')}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={save} loading={saving}>{t('common.save')}</Button>
          </>
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">{entry.customer?.name}</p>
            <p className="text-sm text-slate-500">#{entry.customer?.code} · {fmtDate(entry.entry_date)}</p>
          </div>
          <SessionBadge session={entry.session} />
        </div>

        {entry.locked && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-600">
            <Lock className="size-4 shrink-0" /> {t('collection.locked_hint')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('collection.quantity')} error={errors.quantity?.[0]}>
            {({ id, invalid }) => (
              <Input id={id} invalid={invalid} type="number" inputMode="decimal" step="0.01" disabled={!editable}
                value={form.quantity ?? ''} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            )}
          </Field>
          {milk.fat_enabled !== false && (
            <Field label={t('collection.fat')} error={errors.fat?.[0]}>
              {({ id, invalid }) => (
                <Input id={id} invalid={invalid} type="number" inputMode="decimal" step="0.1" disabled={!editable}
                  value={form.fat ?? ''} onChange={(e) => setForm({ ...form, fat: e.target.value })} />
              )}
            </Field>
          )}
          <Field label={t('collection.rate')} error={errors.rate?.[0]}>
            {({ id, invalid }) => (
              <Input id={id} invalid={invalid} type="number" inputMode="decimal" step="0.01" disabled={!editable || milk.allow_rate_override === false}
                value={form.rate ?? ''} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            )}
          </Field>
          <div className="flex flex-col justify-end">
            <p className="text-sm text-slate-500">{t('collection.amount')}</p>
            <p className="tabular text-2xl font-bold text-slate-900">{money(entry.amount)}</p>
          </div>
        </div>

        <Field label={t('common.notes')} className="mt-3">
          {({ id }) => <Input id={id} disabled={!editable} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
        </Field>

        <EntryActions entry={entry} actions={docs.entry} busy={docs.busy} size="md" className="mt-5" />
      </Modal>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        title={t('collection.delete_entry')}
        message={t('collection.delete_confirm')}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}
