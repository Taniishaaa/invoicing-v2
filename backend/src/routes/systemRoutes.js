import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import { getUploadLockHandler, setUploadLockHandler } from '../controllers/systemController.js'

const router = Router()
router.use(authenticate)

// All roles can read the lock status
router.get('/upload-lock', getUploadLockHandler)

// Only admin, hr_team, finance_team can change it
router.post('/upload-lock', authorize('super_admin', 'hr_team', 'finance_team'), setUploadLockHandler)

export default router
