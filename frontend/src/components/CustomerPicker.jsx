import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Search, X } from 'lucide-react'
import { useOffline } from '../context/OfflineContext'
import { searchCustomers } from '../services/customerCache'
import { Badge } from './ui'
import { cn } from '../utils/cn'

/**
 * Keyboard-first customer search over the on-device customer list.
 * Type an ID and press Enter → selected. ↑/↓ to move, Esc to clear.
 */
export const CustomerPicker = forwardRef(function CustomerPicker(
  { value, onChange, placeholder, size = 'lg', includeInactive = false, autoFocus = false, hint },
  ref,
) {
  const { t } = useTranslation()
  const { customers } = useOffline()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef(null)

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }))

  const results = useMemo(() => {
    const list = includeInactive ? customers : customers.filter((c) => c.active)
    return searchCustomers(list, term, 8)
  }, [customers, term, includeInactive])

  const pick = (c) => {
    onChange(c)
    setTerm('')
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) pick(results[active])
    } else if (e.key === 'Escape') {
      setTerm('')
      setOpen(false)
    }
  }

  if (value) {
    return (
      <div className={cn('flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 px-4', size === 'lg' ? 'py-3' : 'py-2')}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white tabular">
          {value.code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-slate-900">{value.name}</p>
          <p className="flex items-center gap-2 truncate text-sm text-slate-500">
            {value.village && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{value.village}</span>}
            {value.mobile && <span>{value.mobile}</span>}
            {value.active === false && <Badge tone="red">{t('common.inactive')}</Badge>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { onChange(null); setTimeout(() => input.current?.focus(), 0) }}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-white"
        >
          {t('collection.change_customer')}
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={input}
        type="text"
        inputMode="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={term}
        placeholder={placeholder || t('collection.search_customer')}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="customer-results"
        className={cn(
          'w-full rounded-2xl border border-line bg-white pr-10 pl-12 font-medium shadow-xs placeholder:font-normal placeholder:text-slate-400',
          'focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none',
          size === 'lg' ? 'h-14 text-lg' : 'h-11 text-base',
        )}
      />
      {term && (
        <button type="button" onClick={() => setTerm('')} className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-slate-400" aria-label={t('common.clear')}>
          <X className="size-4" />
        </button>
      )}
      {hint && !term && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}

      {open && term && (
        <ul id="customer-results" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-line bg-white py-1 shadow-(--shadow-pop)">
          {results.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">{t('customers.no_match')}</li>}
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left', i === active && 'bg-brand-50')}
              >
                <span className="flex h-8 min-w-10 items-center justify-center rounded-lg bg-slate-100 px-2 text-sm font-bold text-slate-700 tabular">{c.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{c.name}</span>
                  <span className="block truncate text-xs text-slate-500">{[c.village, c.mobile].filter(Boolean).join(' · ')}</span>
                </span>
                {!c.active && <Badge tone="red">{t('common.inactive')}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
