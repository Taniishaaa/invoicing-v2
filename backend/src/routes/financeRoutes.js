import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import {
  getFinanceDashboardHandler,
  getFinanceInvoicesHandler,
  clearInvoiceHandler,
  rejectInvoiceFinanceHandler,
  markPaymentHandler,
  bulkMarkPaymentHandler,
  getFinanceLogHandler,
  financeExportExcelHandler,
  financeExportZipHandler,
  getFinanceWorklistHandler,
  verifyFinanceInvoiceHandler,
  generatePaymentTemplateHandler,
  previewPaymentImportHandler,
  confirmPaymentImportHandler,
  uploadExcel,
  bulkFinanceActionHandler,
  paymentFilters
} from '../controllers/financeController.js'

const router = Router()
router.use(authenticate, authorize('finance_team', 'super_admin'))

router.get('/dashboard',                  getFinanceDashboardHandler)
router.get('/invoices',                   getFinanceInvoicesHandler)
router.get('/invoices/worklist',          getFinanceWorklistHandler)
router.get('/invoices/export/excel',      financeExportExcelHandler)
router.post('/invoices/export/zip',       financeExportZipHandler)
router.patch('/invoices/:id/verify',      verifyFinanceInvoiceHandler)
router.patch('/invoices/:id/clear',       clearInvoiceHandler)
router.patch('/invoices/:id/reject',      rejectInvoiceFinanceHandler)
router.patch(
  '/batches/:batchId/action',
  bulkFinanceActionHandler
)
router.patch(
  '/batches/:batchId/payment',
  markPaymentHandler
)
router.post(
  '/batches/bulk-payment',
  bulkMarkPaymentHandler
)
router.get('/invoices/:id/log',           getFinanceLogHandler)

router.get('/payment-template',           generatePaymentTemplateHandler)
router.post('/payment-import/preview',    uploadExcel.single('file'), previewPaymentImportHandler)
router.post('/payment-import/confirm',    confirmPaymentImportHandler)
router.get('/payment-filters',  paymentFilters)

export default router
