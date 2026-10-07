import { useTranslation } from 'react-i18next'
import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../utils/cn'

export function Spinner({ className, label }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-10 text-slate-500', className)} role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, text, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-7" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)} role="alert">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertCircle className="size-7" aria-hidden />
      </span>
      <p className="max-w-sm text-sm font-medium text-slate-700">{error?.message || t('errors.generic')}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>{t('common.retry')}</Button>
      )}
    </div>
  )
}
