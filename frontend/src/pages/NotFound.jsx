import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPinOff } from 'lucide-react'
import { EmptyState, Button } from '../components/ui'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen items-center justify-center">
      <EmptyState
        icon={MapPinOff}
        title={t('errors.not_found_title')}
        text={t('errors.not_found_text')}
        action={<Link to="/"><Button>{t('errors.go_home')}</Button></Link>}
      />
    </div>
  )
}
