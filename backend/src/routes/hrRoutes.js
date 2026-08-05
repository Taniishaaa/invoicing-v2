import { Router } from 'express'
import {
  authenticate,
  authorize
} from '../middleware/authMiddleware.js'

import {
  getHrDashboardHandler,
  getHrInvoicesHandler,
  getHrWorklistHandler,
  verifyInvoiceHandler,
  reviewInvoiceHandler,
  approveInvoiceHandler,
  rejectInvoiceHandler,
  getHrLogHandler,
  hrExportExcelHandler,
  hrExportZipHandler,
  bulkAction
} from '../controllers/hrController.js'

const router = Router()

router.use(
  authenticate,
  authorize(
    'hr_team',
    'super_admin'
  )
)

router.get(
  '/dashboard',
  getHrDashboardHandler
)

router.get(
  '/invoices',
  getHrInvoicesHandler
)

router.get(
  '/invoices/worklist',
  getHrWorklistHandler
)

router.get(
  '/invoices/export/excel',
  hrExportExcelHandler
)

router.post(
  '/invoices/export/zip',
  hrExportZipHandler
)

router.patch(
  '/invoices/:id/verify',
  verifyInvoiceHandler
)

router.patch(
  '/invoices/:id/review',
  reviewInvoiceHandler
)

router.patch(
  '/invoices/:id/approve',
  approveInvoiceHandler
)

router.patch(
  '/invoices/:id/reject',
  rejectInvoiceHandler
)

router.get(
  '/invoices/:id/log',
  getHrLogHandler
)

router.patch(
    '/batches/:batchId/bulk/:action',
    bulkAction
)

export default router