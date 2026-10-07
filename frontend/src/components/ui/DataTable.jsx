import { cn } from '../../utils/cn'
import { SkeletonRows } from './Feedback'

/**
 * Responsive table: real <table> from md up, stacked cards on phones.
 * columns: [{ key, header, render?(row), align?, className?, mobile?: 'title'|'subtitle'|'value'|'hide' }]
 */
export function DataTable({ columns, rows, loading, onRowClick, empty, rowKey = 'id', footer }) {
  if (loading && !rows?.length) return <SkeletonRows />
  if (!rows?.length) return empty || null

  const cell = (col, row) => (col.render ? col.render(row) : row[col.key])
  const title = columns.find((c) => c.mobile === 'title')
  const subtitle = columns.filter((c) => c.mobile === 'subtitle')
  const value = columns.find((c) => c.mobile === 'value')
  const rest = columns.filter((c) => !c.mobile)

  return (
    <div className={cn(loading && 'opacity-60 transition-opacity')}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-slate-50/70 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {columns.filter((c) => c.mobile !== 'only').map((c) => (
                <th key={c.key} className={cn('px-4 py-3 whitespace-nowrap', c.align === 'right' && 'text-right', c.className)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={row[rowKey]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer hover:bg-brand-50/40')}
              >
                {columns.filter((c) => c.mobile !== 'only').map((c) => (
                  <td key={c.key} className={cn('px-4 py-3', c.align === 'right' && 'tabular text-right', c.className)}>{cell(c, row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <li key={row[rowKey]}>
            <div
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              className={cn('flex items-start justify-between gap-3 px-4 py-3.5', onRowClick && 'active:bg-slate-50')}
            >
              <div className="min-w-0 flex-1">
                {title && <div className="truncate font-semibold text-slate-900">{cell(title, row)}</div>}
                {subtitle.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                    {subtitle.map((c) => <span key={c.key}>{cell(c, row)}</span>)}
                  </div>
                )}
                {rest.filter((c) => c.mobile !== 'hide').length > 0 && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {rest.filter((c) => c.mobile !== 'hide').map((c) => (
                      <div key={c.key} className="flex gap-1">
                        <dt className="text-slate-400">{c.header}:</dt>
                        <dd className="tabular font-medium text-slate-700">{cell(c, row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              {value && <div className="tabular shrink-0 text-right font-semibold text-slate-900">{cell(value, row)}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
