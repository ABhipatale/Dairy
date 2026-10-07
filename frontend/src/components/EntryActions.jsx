import { useTranslation } from 'react-i18next'
import { MessageSquareText, Printer, Send } from 'lucide-react'
import { Button } from './ui'
import { cn } from '../utils/cn'

/** The three always-visible post-save actions: Print · WhatsApp · Print + WhatsApp. */
export function EntryActions({ entry, actions, busy, size = 'lg', className }) {
  const { t } = useTranslation()

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <Button variant="secondary" size={size} icon={Printer} loading={busy === 'print'} disabled={!!busy} onClick={() => actions.print(entry)}>
        {t('common.print')}
      </Button>
      <Button variant="whatsapp" size={size} icon={MessageSquareText} loading={busy === 'whatsapp'} disabled={!!busy} onClick={() => actions.whatsapp(entry)}>
        {t('common.whatsapp')}
      </Button>
      <Button variant="primary" size={size} icon={Send} loading={busy === 'both'} disabled={!!busy} onClick={() => actions.both(entry)} className="col-span-2">
        {t('common.print_whatsapp')}
      </Button>
    </div>
  )
}
