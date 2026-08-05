import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import {exportExcel, filters} from '../controllers/exportController.js'

const router = Router()
router.use(authenticate, authorize('finance_team', 'super_admin', 'hr_team', 'compliance_team'))

router.get(
  '/excel',
  exportExcel
)

router.get(
  '/filters',
  filters

)

export default router