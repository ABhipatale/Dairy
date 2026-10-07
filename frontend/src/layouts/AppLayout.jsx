import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, CloudOff, LogOut, Menu, RefreshCw, User, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import { ADMIN_NAV, BOTTOM_NAV, TENANT_NAV } from '../constants/navigation'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { OfflineBanner } from '../components/OfflineBanner'
import { UpdatePrompt } from '../components/UpdatePrompt'
import { cn } from '../utils/cn'

function isActive(location, to, end) {
  const [path, query] = to.split('?')
  if (query) return location.pathname === path && location.search.includes(query)
  if (end) return location.pathname === path && !location.search.includes('status=')
  return location.pathname.startsWith(path)
}

function NavItems({ items, onNavigate }) {
  const { t } = useTranslation()
  const { can } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(() => new Set(items.filter((i) => i.children?.some((c) => isActive(location, c.to, c.end))).map((i) => i.label)))

  const visible = items.filter((i) => !i.perm || can(i.perm))

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {visible.map((item) => {
        if (!item.children) {
          const active = isActive(location, item.to, item.end)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {t(item.label)}
            </Link>
          )
        }

        const expanded = open.has(item.label)
        const children = item.children.filter((c) => !c.perm || can(c.perm))
        const groupActive = children.some((c) => isActive(location, c.to, c.end))

        return (
          <div key={item.label}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen((s) => {
                const n = new Set(s)
                if (n.has(item.label)) n.delete(item.label)
                else n.add(item.label)
                return n
              })}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                groupActive ? 'text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <item.icon className="size-5" aria-hidden />
              <span className="flex-1 text-left">{t(item.label)}</span>
              <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
            </button>
            {expanded && (
              <div className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-line pl-3">
                {children.map((c) => {
                  const active = isActive(location, c.to, c.end)
                  return (
                    <Link
                      key={c.to}
                      to={c.to}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm transition-colors',
                        active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      {t(c.label)}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function Brand() {
  const { tenant, session } = useAuth()
  const name = tenant?.name || session?.platform?.app_name || 'Dtico Dairy'

  return (
    <Link to={tenant ? '/' : '/admin'} className="flex items-center gap-3">
      {tenant?.logo_url ? (
        <img src={tenant.logo_url} alt="" className="size-9 rounded-xl object-cover ring-1 ring-line" />
      ) : (
        <img src="/pwa-192x192.png" alt="" className="size-9 rounded-xl" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold leading-tight text-slate-900">{name}</span>
        {tenant?.city && <span className="block truncate text-xs text-slate-500">{tenant.city}</span>}
      </span>
    </Link>
  )
}

function UserBlock({ onNavigate }) {
  const { t } = useTranslation()
  const { user, tenant, logout, isSuperAdmin } = useAuth()

  return (
    <div className="flex items-center gap-2 border-t border-line pt-3">
      <Link to={isSuperAdmin ? '/admin/profile' : '/profile'} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 hover:bg-slate-100">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
          {(user?.name || '?').slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-800">{user?.name}</span>
          <span className="block truncate text-xs text-slate-500">{isSuperAdmin ? t('settings.users_fields.roles.super_admin') : user?.mobile || tenant?.name}</span>
        </span>
      </Link>
      <button type="button" onClick={logout} className="rounded-xl p-2.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label={t('nav.logout')} title={t('nav.logout')}>
        <LogOut className="size-5" />
      </button>
    </div>
  )
}

function SyncIndicator() {
  const { t } = useTranslation()
  const { online, stats, syncing, sync } = useOffline() || {}
  if (!stats?.pending && online) return null

  return (
    <button
      type="button"
      onClick={() => sync()}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        online ? 'bg-amber-50 text-amber-800' : 'bg-slate-200 text-slate-700',
      )}
      title={t('offline.sync_now')}
    >
      {online ? <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} /> : <CloudOff className="size-3.5" />}
      {stats?.pending || 0}
    </button>
  )
}

export function AppLayout({ admin = false }) {
  const { t } = useTranslation()
  const { can } = useAuth()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const items = admin ? ADMIN_NAV : TENANT_NAV

  useEffect(() => setDrawer(false), [location.pathname])

  const bottom = admin ? [] : BOTTOM_NAV.filter((i) => can(i.perm))

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 border-r border-line bg-white px-3 py-4 lg:flex">
        <div className="px-2"><Brand /></div>
        <div className="flex-1 overflow-y-auto"><NavItems items={items} /></div>
        <div className="px-1"><LanguageSwitcher compact /></div>
        <UserBlock />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 bg-white px-3 py-4 shadow-(--shadow-pop)">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button type="button" onClick={() => setDrawer(false)} className="rounded-lg p-2 text-slate-500" aria-label={t('common.close')}>
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavItems items={items} onNavigate={() => setDrawer(false)} /></div>
            <div className="px-1"><LanguageSwitcher compact /></div>
            <UserBlock onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setDrawer(true)} className="rounded-xl p-2 text-slate-600" aria-label={t('nav.menu')}>
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1"><Brand /></div>
          <SyncIndicator />
          <Link to={admin ? '/admin/profile' : '/profile'} className="rounded-xl p-2 text-slate-600" aria-label={t('nav.profile')}>
            <User className="size-5" />
          </Link>
        </header>

        {!admin && <OfflineBanner />}
        <UpdatePrompt />

        <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 lg:py-8', bottom.length && 'pb-28 lg:pb-8')}>
          <Outlet />
        </main>

        {/* Mobile bottom navigation */}
        {bottom.length > 0 && (
          <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:hidden" aria-label="Quick">
            <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1.5 pb-1.5">
              {bottom.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive: a }) => cn(
                    'flex flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] font-medium',
                    item.primary ? 'text-white' : a ? 'text-brand-700' : 'text-slate-500',
                  )}
                >
                  {item.primary ? (
                    <>
                      <span className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30 ring-4 ring-white">
                        <item.icon className="size-7" aria-hidden />
                      </span>
                      <span className="text-brand-700">{t(item.label)}</span>
                    </>
                  ) : (
                    <>
                      <item.icon className="size-6" aria-hidden />
                      <span className="max-w-full truncate">{t(item.label)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
