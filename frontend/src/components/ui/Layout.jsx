import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '../../utils/cn'

export function PageHeader({ title, subtitle, back, actions, className }) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className={cn('mb-5 flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {back && (
          <button
            type="button"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            className="-ml-2 rounded-xl p-2 text-slate-500 hover:bg-white hover:text-slate-800"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Compact KPI tile. */
export function StatCard({ label, value, sub, icon: Icon, tone = 'brand', onClick }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={cn('card flex items-start gap-3 p-4 text-left', onClick && 'transition-colors hover:border-brand-200')}>
      {Icon && (
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="tabular mt-0.5 truncate text-xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
      </div>
    </Tag>
  )
}

export function SearchInput({ value, onChange, placeholder, autoFocus, className, inputRef }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-11 w-full rounded-xl border border-line bg-white pr-10 pl-10 text-base shadow-xs placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600" aria-label="Clear">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Segmented control (session switch, tabs). */
export function Segmented({ options, value, onChange, size = 'md', className }) {
  return (
    <div className={cn('inline-flex rounded-xl bg-slate-100 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-all',
            size === 'lg' ? 'h-11 px-4 text-base' : 'h-9 px-3 text-sm',
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {o.icon && <o.icon className="size-4" aria-hidden />}
          {o.label}
          {o.count != null && <span className="rounded-full bg-slate-200/70 px-1.5 text-xs text-slate-600">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Pagination({ meta, onPage }) {
  const { t } = useTranslation()
  if (!meta || meta.last_page <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-slate-600">
      <span>{t('common.showing', { from: meta.from, to: meta.to, total: meta.total })}</span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={meta.current_page <= 1}
          onClick={() => onPage(meta.current_page - 1)}
          className="rounded-lg border border-line bg-white p-2 disabled:opacity-40"
          aria-label={t('common.previous')}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="flex items-center px-2 font-medium">{t('common.page_of', { page: meta.current_page, pages: meta.last_page })}</span>
        <button
          type="button"
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPage(meta.current_page + 1)}
          className="rounded-lg border border-line bg-white p-2 disabled:opacity-40"
          aria-label={t('common.next')}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
