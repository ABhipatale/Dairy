import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/cn'

const TONES = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
}

export function Badge({ tone = 'gray', className, children, dot }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

const BILL_TONES = {
  draft: 'gray', generated: 'blue', pending: 'amber', partially_paid: 'violet', paid: 'green', cancelled: 'red', unbilled: 'gray',
}

export function BillStatusBadge({ status }) {
  const { t } = useTranslation()
  return <Badge tone={BILL_TONES[status] || 'gray'} dot>{t(`billing.status.${status}`)}</Badge>
}

export function SessionBadge({ session }) {
  const { t } = useTranslation()
  return <Badge tone={session === 'morning' ? 'amber' : 'violet'}>{t(`common.${session}`)}</Badge>
}
