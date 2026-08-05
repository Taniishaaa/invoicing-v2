import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import upload from '../middleware/uploadMiddleware.js'
import {
  getBatches, getBatch,
  downloadBatchPdfsHandler,
  getSupportingDocsHandler, viewSupportingDocHandler, downloadSupportingDocsHandler,
  uploadInternalDocHandler, listInternalDocsHandler, viewInternalDocHandler, deleteInternalDocHandler,
  downloadInternalDocsHandler
} from '../controllers/batchController.js'

const router = Router()
router.use(authenticate)

router.get('/', getBatches)
router.get('/:id', getBatch)
router.get('/:id/download-pdfs', downloadBatchPdfsHandler)

// Vendor supporting docs (existing)
router.get('/:id/supporting-documents', getSupportingDocsHandler)
router.get('/supporting-documents/:id/view', viewSupportingDocHandler)
router.get('/:id/download-supporting-docs', downloadSupportingDocsHandler)

// Internal team supporting documents (BatchSupportingDocument)
router.post(
  '/:id/internal-docs',
  authorize('hr_team', 'compliance_team', 'finance_team', 'super_admin'),
  upload.single('document'),
  uploadInternalDocHandler
)
router.get('/:id/internal-docs', listInternalDocsHandler)
router.get('/internal-docs/:docId/view', viewInternalDocHandler)
router.delete(
  '/internal-docs/:docId',
  authorize('hr_team', 'compliance_team', 'finance_team', 'super_admin'),
  deleteInternalDocHandler
)
router.get(
  '/:id/download-internal-docs',
  authenticate,
  downloadInternalDocsHandler
)

export default router
