import {
  BarChart3, Building2, ClipboardList, FileText, Globe, History, LayoutDashboard, Milk, Settings, SlidersHorizontal, Users, Wallet,
} from 'lucide-react'

/** Sidebar structure. `perm` hides items the user can't use. */
export const TENANT_NAV = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard, perm: 'milk.view', end: true },
  {
    label: 'nav.collection', icon: Milk, perm: 'milk.view', children: [
      { to: '/collection', label: 'nav.add_milk', perm: 'milk.create', end: true },
      { to: '/collection/today', label: 'nav.today_entries', perm: 'milk.view' },
      { to: '/collection/history', label: 'nav.milk_history', perm: 'milk.view' },
    ],
  },
  {
    label: 'nav.customers', icon: Users, perm: 'customers.view', children: [
      { to: '/customers', label: 'nav.all_customers', perm: 'customers.view', end: true },
      { to: '/customers/new', label: 'nav.add_customer', perm: 'customers.manage' },
    ],
  },
  {
    label: 'nav.billing', icon: FileText, perm: 'bills.view', children: [
      { to: '/bills', label: 'nav.ten_day_bills', perm: 'bills.view', end: true },
      { to: '/bills?status=open', label: 'nav.pending_bills', perm: 'bills.view' },
      { to: '/bills?status=paid', label: 'nav.paid_bills', perm: 'bills.view' },
      { to: '/payments', label: 'nav.payments', perm: 'payments.view' },
    ],
  },
  {
    label: 'nav.reports', icon: BarChart3, perm: 'reports.view', children: [
      { to: '/reports/daily', label: 'nav.daily', perm: 'reports.view' },
      { to: '/reports/ten_day', label: 'nav.ten_day', perm: 'reports.view' },
      { to: '/reports/monthly', label: 'nav.monthly', perm: 'reports.view' },
      { to: '/reports/yearly', label: 'nav.yearly', perm: 'reports.view' },
    ],
  },
  { to: '/settings', label: 'nav.settings', icon: Settings, perm: 'settings.manage' },
]

export const ADMIN_NAV = [
  { to: '/admin', label: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/tenants', label: 'nav.companies', icon: Building2 },
  { to: '/admin/languages', label: 'nav.languages', icon: Globe },
  { to: '/admin/settings', label: 'nav.global_settings', icon: SlidersHorizontal },
  { to: '/admin/audit', label: 'nav.audit', icon: History },
]

/** Phone bottom bar: the 4 most frequent destinations + the big "Add Milk" button. */
export const BOTTOM_NAV = [
  { to: '/', label: 'nav.home', icon: LayoutDashboard, perm: 'milk.view', end: true },
  { to: '/customers', label: 'nav.customers', icon: Users, perm: 'customers.view' },
  { to: '/collection', label: 'nav.add_milk', icon: Milk, perm: 'milk.create', primary: true, end: true },
  { to: '/bills', label: 'nav.bills', icon: Wallet, perm: 'bills.view' },
  { to: '/collection/today', label: 'nav.today', icon: ClipboardList, perm: 'milk.view' },
]
