import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import AuthProvider     from './context/AuthProvider'
import ProtectedRoute   from './routes/ProtectedRoute'
import PublicRoute      from './routes/PublicRoute'
import HomeRedirect     from './routes/HomeRedirect'
import LoginPage        from './pages/Login'

// Layouts
import AdminLayout      from './layouts/AdminLayout'
import HrLayout         from './layouts/HRLayout'
import FinanceLayout    from './layouts/FinanceLayout'
import VendorLayout     from './layouts/VendorLayout'
import ComplianceLayout from './layouts/ComplianceLayout'

// Admin Pages
import AdminDashboard   from './pages/admin/Dashboard'
import AdminBatches     from './pages/admin/AdminInv'
import HrPartnersList   from './pages/admin/HRPartnerList'
import AdminList        from './pages/admin/AdminList'

// HR Pages
import HRDashboard      from './pages/hr/HRDashboard'
import HRBatches from './pages/hr/HRBatches'

// Compliance Pages
import ComplianceDashboard from './pages/compliance/ComplianceDashboard'
import ComplianceBatches from './pages/compliance/ComplianceBatches'

// Finance Pages
import FinanceDashboard from './pages/finance/FinanceDashboard'
import FinanceBatches from './pages/finance/FinanceBatches'
import PaymentUpload    from './pages/finance/PaymentUpload'

// Vendor Pages
import VendorDashboard     from './pages/vendor/Dashboard'
import UploadInvoices      from './pages/vendor/UploadInvoices'
import UploadCreditNotes   from './pages/vendor/UploadCreditNotes'
import VendorInv           from './pages/vendor/VendorInvoices'
import VendorViewInv       from './pages/vendor/VendorViewInv'

// Shared
import Profile          from './pages/shared/Profile'
import VendorProfile    from './pages/shared/VendorProfile'
import InvoiceDetail    from './pages/shared/InvoiceDetail'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>

          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

          {/* ADMIN */}
          <Route path="/admin" element={<ProtectedRoute roles={['super_admin']}><AdminLayout /></ProtectedRoute>}>
            <Route index                     element={<AdminDashboard />} />
            <Route path="invoices"           element={<AdminBatches />} />
            <Route path="invoices/:id"       element={<InvoiceDetail />} />
            <Route path="hr-partners"        element={<HrPartnersList />} />
            <Route path="admins"             element={<AdminList />} />
            <Route path="profile"            element={<Profile />} />
          </Route>

          {/* HR */}
          <Route path="/hr" element={<ProtectedRoute roles={['hr_team']}><HrLayout /></ProtectedRoute>}>
            <Route index                     element={<HRDashboard />} />
            <Route path="invoices"           element={<HRBatches />} />
            <Route path="invoices/:id"       element={<InvoiceDetail />} />
            <Route path="partners"           element={<HrPartnersList />} />
            <Route path="profile"            element={<Profile />} />
          </Route>

          {/* COMPLIANCE */}
          <Route path="/compliance" element={<ProtectedRoute roles={['compliance_team']}><ComplianceLayout /></ProtectedRoute>}>
            <Route index                     element={<ComplianceDashboard />} />
            <Route path="invoices"           element={<ComplianceBatches />} />
            <Route path="invoices/:id"       element={<InvoiceDetail />} />
            <Route path="profile"            element={<Profile />} />
          </Route>

          {/* FINANCE */}
          <Route path="/finance" element={<ProtectedRoute roles={['finance_team']}><FinanceLayout /></ProtectedRoute>}>
            <Route index                     element={<FinanceDashboard />} />
            <Route path="invoices"           element={<FinanceBatches/>} />
            <Route path="invoices/:id"       element={<InvoiceDetail />} />
            <Route path="payment-upload"     element={<PaymentUpload />} />
            <Route path="profile"            element={<Profile />} />
          </Route>

          {/* VENDOR */}
          <Route path="/vendor" element={<ProtectedRoute roles={['vendor']}><VendorLayout /></ProtectedRoute>}>
            <Route index                     element={<VendorDashboard />} />
            <Route path="invoices"           element={<VendorInv />} />
            <Route path="invoices/:id"       element={<VendorViewInv />} />
            <Route path="upload"             element={<UploadInvoices />} />
            <Route path="upload-credit-notes" element={<UploadCreditNotes />} />
            <Route path="profile"            element={<VendorProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
