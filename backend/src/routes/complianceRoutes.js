import { Router } from 'express'

import {
  authenticate,
  authorize
} from '../middleware/authMiddleware.js'

import {
  getComplianceDashboardHandler,
  getComplianceInvoicesHandler,
  getComplianceWorklistHandler,
  verifyComplianceInvoiceHandler,
  rejectComplianceInvoiceHandler,
  getComplianceLogHandler,
  complianceExportExcelHandler,
  complianceExportZipHandler,
  bulkComplianceVerifyHandler
} from '../controllers/complianceController.js'

const router = Router()

router.use(
  authenticate,
  authorize(
    'compliance_team',
    'super_admin'
  )
)

router.get(
  '/dashboard',
  getComplianceDashboardHandler
)

router.get(
  '/invoices',
  getComplianceInvoicesHandler
)

router.get(
  '/invoices/worklist',
  getComplianceWorklistHandler
)

router.get(
  '/invoices/export/excel',
  complianceExportExcelHandler
)

router.post(
  '/invoices/export/zip',
  complianceExportZipHandler
)

router.patch(
  '/invoices/:id/verify',
  verifyComplianceInvoiceHandler
)

router.patch(
  '/invoices/:id/reject',
  rejectComplianceInvoiceHandler
)

router.patch(
  '/batches/:id/bulk/verify',
  bulkComplianceVerifyHandler
)

router.get(
  '/invoices/:id/log',
  getComplianceLogHandler
)

export default router