import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/ui'
import { AuditTable } from '../../components/AuditTable'

export default function AdminAudit() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('nav.audit')} />
      <AuditTable url="/admin/audit-logs" />
    </div>
  )
}
