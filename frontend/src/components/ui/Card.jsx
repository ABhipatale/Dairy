import { cn } from '../../utils/cn'

export function Card({ className, children, as: Tag = 'div', ...props }) {
  return (
    <Tag className={cn('card', className)} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cn('px-4 py-4 sm:px-5', className)}>{children}</div>
}

/** Label/value line used in summaries (bill totals, profile). */
export function Row({ label, value, strong, muted, className }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <span className={cn('text-sm', muted ? 'text-slate-400' : 'text-slate-600')}>{label}</span>
      <span className={cn('tabular text-right', strong ? 'text-base font-bold text-slate-900' : 'text-sm font-medium text-slate-800')}>{value}</span>
    </div>
  )
}
