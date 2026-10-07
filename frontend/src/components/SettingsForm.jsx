import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardHeader } from './ui'

/**
 * Card that edits one settings group with a local draft and a Save button.
 * children(draft, set) renders the fields.
 */
export function SettingsCard({ title, subtitle, values, onSave, saving, children }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(values || {})

  useEffect(() => setDraft(values || {}), [values])

  const dirty = JSON.stringify(draft) !== JSON.stringify(values || {})
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="px-4 py-2 sm:px-5">{children(draft, set)}</div>
      <div className="flex items-center justify-end gap-3 border-t border-line px-4 py-3 sm:px-5">
        {dirty && <span className="text-xs text-amber-700">{t('common.unsaved')}</span>}
        <Button onClick={() => onSave(draft)} loading={saving} disabled={!dirty}>{t('common.save')}</Button>
      </div>
    </Card>
  )
}
