import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import upload from '../middleware/uploadMiddleware.js'
import { downloadFile } from '../services/s3Service.js'
import {
  uploadInvoicesHandler,
  uploadCreditNotesHandler,
  getVendorInvoicesHandler,
  deleteInvoiceHandler,
  reuploadInvoiceHandler,
  dashboard,
  getVendorCreditNotesHandler
} from '../controllers/vendorController.js'

const router = Router()
router.use(authenticate, authorize('vendor'))

router.post(
  '/upload',
  authenticate,
  authorize('vendor'),
  upload.fields([
    {
      name: 'invoices',
      maxCount: 60
    },
    {
      name: 'supportingDocuments',
      maxCount: 10
    }
  ]),
  uploadInvoicesHandler
)
router.post(
  '/upload-credit-notes',
  upload.fields([
    { name: 'invoices', maxCount: 60 },
    { name: 'supportingDocuments', maxCount: 10 }
  ]),
  uploadCreditNotesHandler
)
router.get('/invoices',             getVendorInvoicesHandler)
router.delete('/invoices/:id',      deleteInvoiceHandler)
router.post('/invoices/:id/reupload', upload.single('file'), reuploadInvoiceHandler)
router.get(
  '/dashboard',
  authenticate,
  authorize('vendor'),
  dashboard
)
router.get(
  '/credit-notes',
  getVendorCreditNotesHandler
)

export default router
