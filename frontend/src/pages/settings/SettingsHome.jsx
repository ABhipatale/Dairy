import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, ChevronRight, IndianRupee, Languages, MessageSquareText, Printer, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { Card, PageHeader } from '../../components/ui'

const SECTIONS = [
  { to: '/settings/company', key: 'company', icon: Building2, perm: 'settings.manage' },
  { to: '/settings/pricing', key: 'pricing', icon: IndianRupee, perm: 'settings.manage' },
  { to: '/settings/printer', key: 'printer', icon: Printer, perm: 'settings.manage' },
  { to: '/settings/whatsapp', key: 'whatsapp', icon: MessageSquareText, perm: 'settings.manage' },
  { to: '/settings/general', key: 'general', icon: SlidersHorizontal, perm: 'settings.manage', desc: 'general_desc' },
]

export default function SettingsHome() {
  const { t } = useTranslation()
  const { can } = useAuth()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('settings.title')} />

      <Card className="divide-y divide-line">
        {SECTIONS.filter((s) => can(s.perm)).map(({ to, key, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-4 px-4 py-4 hover:bg-slate-50 sm:px-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">{t(`settings.${key}`)}</span>
              <span className="block truncate text-sm text-slate-500">{t(`settings.${key}_desc`)}</span>
            </span>
            <ChevronRight className="size-5 text-slate-300" />
          </Link>
        ))}
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Languages className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900">{t('settings.language')}</span>
            <span className="block text-sm text-slate-500">{t('settings.language_desc')}</span>
          </span>
          <LanguageSwitcher compact className="sm:w-64" />
        </div>
      </Card>
    </div>
  )
}
