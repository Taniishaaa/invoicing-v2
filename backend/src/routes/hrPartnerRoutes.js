import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authMiddleware.js'

import {
  createHrPartnerHandler,
  getHrPartnersHandler,
  toggleHrPartnerHandler,
  deleteHrPartnerHandler,
  resetHrPartnerPasswordHandler,
  getHrInvoicesHandler,
  hrExportExcelHandler,
  hrExportZipHandler,
} from '../controllers/hrPartnerController.js'

const router = Router()

router.use(authenticate)

// Invoice routes — accessible by both super_admin and hr_team
router.get('/invoices',              authorize('super_admin', 'hr_team', 'compliance_team',
    'finance_team'), getHrInvoicesHandler)
router.get('/invoices/export/excel', authorize('super_admin', 'hr_team', 'compliance_team',
    'finance_team'), hrExportExcelHandler)
router.post('/invoices/export/zip',  authorize('super_admin', 'hr_team', 'compliance_team',
    'finance_team'), hrExportZipHandler)

// HR Partner management — super_admin only
router.get('/',                      authorize('super_admin', 'hr_team', 'compliance_team','finance_team'), getHrPartnersHandler)
router.post('/',                     authorize('super_admin'),            createHrPartnerHandler)
router.patch('/:id/toggle-active',   authorize('super_admin'),            toggleHrPartnerHandler)
router.delete('/:id',                authorize('super_admin'),            deleteHrPartnerHandler)
router.post('/:id/reset-password',   authorize('super_admin'),            resetHrPartnerPasswordHandler)

export default router
