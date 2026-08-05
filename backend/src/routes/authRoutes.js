import {
  Router
} from 'express'

import {
  login,
  me,
  logout,
  changePasswordHandler
} from '../controllers/authController.js'

import {
  authenticate
} from '../middleware/authMiddleware.js'

const router = Router()

router.post('/login',login)
router.post('/logout',logout)
router.get('/me', authenticate, me)
router.post('/change-password', authenticate, changePasswordHandler)

export default router