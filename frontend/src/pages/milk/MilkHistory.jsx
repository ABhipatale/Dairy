import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EntriesList } from '../../components/EntriesList'
import { CustomerPicker } from '../../components/CustomerPicker'
import { Field, PageHeader, Select } from '../../components/ui'
import { addDays, isoDate } from '../../utils/format'

export default function MilkHistory() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState({ date_from: addDays(isoDate(), -30), date_to: isoDate(), session: '', billed: '' })
  const [customer, setCustomer] = useState(null)

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  const params = {
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    session: filters.session || undefined,
    billed: filters.billed === '' ? undefined : filters.billed,
    customer_id: customer?.id,
    per_page: 30,
  }

  return (
    <div>
      <PageHeader title={t('collection.history')} />
      <EntriesList
        params={params}
        header={
          <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2 lg:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('common.customer')}</span>
              <CustomerPicker value={customer} onChange={setCustomer} size="md" includeInactive placeholder={t('reports.all_customers')} />
            </div>
            <Field label={t('common.from')}>
              {({ id }) => <input id={id} type="date" value={filters.date_from} onChange={set('date_from')} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" />}
            </Field>
            <Field label={t('common.to')}>
              {({ id }) => <input id={id} type="date" value={filters.date_to} onChange={set('date_to')} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm" />}
            </Field>
            <Field label={t('common.session')}>
              {({ id }) => (
                <Select id={id} value={filters.session} onChange={set('session')}>
                  <option value="">{t('reports.all_sessions')}</option>
                  <option value="morning">{t('common.morning')}</option>
                  <option value="evening">{t('common.evening')}</option>
                </Select>
              )}
            </Field>
          </div>
        }
      />
    </div>
  )
}
