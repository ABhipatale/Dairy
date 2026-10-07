import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AppLayout } from './layouts/AppLayout'
import { Spinner } from './components/ui'
import Login from './pages/Login'

// Route-level code splitting keeps the first load small on slow rural networks.
// The milk entry screen is preloaded right after login because it is used most.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MilkCollection = lazy(() => import('./pages/milk/MilkCollection'))
const TodayEntries = lazy(() => import('./pages/milk/TodayEntries'))
const MilkHistory = lazy(() => import('./pages/milk/MilkHistory'))
const CustomerList = lazy(() => import('./pages/customers/CustomerList'))
const CustomerForm = lazy(() => import('./pages/customers/CustomerForm'))
const CustomerDetail = lazy(() => import('./pages/customers/CustomerDetail'))
const BillList = lazy(() => import('./pages/billing/BillList'))
const BillDetail = lazy(() => import('./pages/billing/BillDetail'))
const GenerateBill = lazy(() => import('./pages/billing/GenerateBill'))
const Payments = lazy(() => import('./pages/billing/Payments'))
const Reports = lazy(() => import('./pages/reports/Reports'))
const SettingsHome = lazy(() => import('./pages/settings/SettingsHome'))
const CompanySettings = lazy(() => import('./pages/settings/CompanySettings'))
const PricingSettings = lazy(() => import('./pages/settings/PricingSettings'))
const PrinterSettings = lazy(() => import('./pages/settings/PrinterSettings'))
const WhatsAppSettings = lazy(() => import('./pages/settings/WhatsAppSettings'))
const GeneralSettings = lazy(() => import('./pages/settings/GeneralSettings'))
const Profile = lazy(() => import('./pages/Profile'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const Tenants = lazy(() => import('./pages/admin/Tenants'))
const TenantDetail = lazy(() => import('./pages/admin/TenantDetail'))
const AdminLanguages = lazy(() => import('./pages/admin/AdminLanguages'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RequireAuth({ children, admin = false }) {
  const { isAuthenticated, isSuperAdmin } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (admin && !isSuperAdmin) return <Navigate to="/" replace />
  if (!admin && isSuperAdmin) return <Navigate to="/admin" replace />
  return children
}

/** Hides screens a role can't use (the API enforces this too). */
function Can({ perm, children }) {
  const { can } = useAuth()
  return can(perm) ? children : <Navigate to="/" replace />
}

/** Operators without dashboard rights land on milk entry. */
function Home() {
  const { can } = useAuth()
  if (!can('reports.view') && can('milk.create')) return <Navigate to="/collection" replace />
  return <Dashboard />
}

export default function App() {
  return (
    <Suspense fallback={<Spinner className="min-h-[60vh]" />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="collection" element={<Can perm="milk.create"><MilkCollection /></Can>} />
          <Route path="collection/today" element={<Can perm="milk.view"><TodayEntries /></Can>} />
          <Route path="collection/history" element={<Can perm="milk.view"><MilkHistory /></Can>} />
          <Route path="customers" element={<Can perm="customers.view"><CustomerList /></Can>} />
          <Route path="customers/new" element={<Can perm="customers.manage"><CustomerForm /></Can>} />
          <Route path="customers/:id" element={<Can perm="customers.view"><CustomerDetail /></Can>} />
          <Route path="customers/:id/edit" element={<Can perm="customers.manage"><CustomerForm /></Can>} />
          <Route path="bills" element={<Can perm="bills.view"><BillList /></Can>} />
          <Route path="bills/new" element={<Can perm="bills.manage"><GenerateBill /></Can>} />
          <Route path="bills/:id" element={<Can perm="bills.view"><BillDetail /></Can>} />
          <Route path="payments" element={<Can perm="payments.view"><Payments /></Can>} />
          <Route path="reports/:type" element={<Can perm="reports.view"><Reports /></Can>} />
          <Route path="reports" element={<Navigate to="/reports/daily" replace />} />
          <Route path="settings" element={<Can perm="settings.manage"><SettingsHome /></Can>} />
          <Route path="settings/company" element={<Can perm="settings.manage"><CompanySettings /></Can>} />
          <Route path="settings/pricing" element={<Can perm="settings.manage"><PricingSettings /></Can>} />
          <Route path="settings/printer" element={<Can perm="settings.manage"><PrinterSettings /></Can>} />
          <Route path="settings/whatsapp" element={<Can perm="settings.manage"><WhatsAppSettings /></Can>} />
          <Route path="settings/general" element={<Can perm="settings.manage"><GeneralSettings /></Can>} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="admin" element={<RequireAuth admin><AppLayout admin /></RequireAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="tenants/:id" element={<TenantDetail />} />
          <Route path="languages" element={<AdminLanguages />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
