import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

const control =
  'w-full rounded-xl border border-line bg-white px-3.5 text-slate-900 placeholder:text-slate-400 shadow-xs ' +
  'transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 ' +
  'disabled:bg-slate-50 disabled:text-slate-500'

const invalid = 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'

/** Label + control + hint/error wrapper. Children receive the generated id. */
export function Field({ label, hint, error, required, className, children, htmlFor }) {
  const auto = useId()
  const id = htmlFor || auto

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {typeof children === 'function' ? children({ id, invalid: !!error }) : children}
      {error ? (
        <p className="text-xs font-medium text-rose-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef(function Input({ className, invalid: isInvalid, size = 'md', prefix, suffix, ...props }, ref) {
  const height = size === 'lg' ? 'h-14 text-xl font-semibold' : size === 'sm' ? 'h-9 text-sm' : 'h-11 text-base'

  if (prefix || suffix) {
    return (
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">{prefix}</span>}
        <input
          ref={ref}
          className={cn(control, height, prefix && 'pl-10', suffix && 'pr-12', isInvalid && invalid, className)}
          aria-invalid={isInvalid || undefined}
          {...props}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-slate-500">{suffix}</span>}
      </div>
    )
  }

  return <input ref={ref} className={cn(control, height, isInvalid && invalid, className)} aria-invalid={isInvalid || undefined} {...props} />
})

export const Select = forwardRef(function Select({ className, invalid: isInvalid, children, size = 'md', ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(control, size === 'sm' ? 'h-9 text-sm' : 'h-11 text-base', 'appearance-none pr-10', isInvalid && invalid, className)}
        aria-invalid={isInvalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ className, invalid: isInvalid, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'py-2.5 text-base', isInvalid && invalid, className)} {...props} />
})

export function Toggle({ checked, onChange, label, description, disabled, id }) {
  const auto = useId()
  const fid = id || auto

  return (
    <label htmlFor={fid} className={cn('flex cursor-pointer items-start justify-between gap-4 py-3', disabled && 'opacity-50')}>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="text-xs text-slate-500">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={fid}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
