import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authMiddleware.js'
import prisma from '../config/prisma.js'

import {
  createAdminHandler,
  getAdminsHandler,
  toggleAdminHandler,
  deleteAdminHandler,
  resetPasswordHandler,
  getDashboardHandler,
  getFunnelHandler,
  getInvoicesHandler,
  exportZipHandler,
} from '../controllers/adminController.js'

const router = Router()

router.use(authenticate, authorize('super_admin'))

router.get('/dashboard',              getDashboardHandler)
router.get('/funnel',                 getFunnelHandler)
router.get('/invoices',               getInvoicesHandler)
router.post('/invoices/export/zip',      exportZipHandler)

// Manual credit note link — admin patches the originalInvoiceId
router.patch('/invoices/:id/link-credit-note', async (req, res) => {
  try {
    const { originalInvoiceId } = req.body
    const cn = await prisma.invoice.findFirst({
      where: { id: req.params.id, isDeleted: false, type: 'credit_note' }
    })
    if (!cn) return res.status(404).json({ success: false, message: 'Credit note not found' })

    if (originalInvoiceId) {
      const orig = await prisma.invoice.findFirst({
        where: { id: originalInvoiceId, isDeleted: false, type: 'regular' }
      })
      if (!orig) return res.status(404).json({ success: false, message: 'Original invoice not found' })
    }

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data:  { originalInvoiceId: originalInvoiceId || null }
    })
    return res.json({ success: true, invoice: updated })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/users',                     getAdminsHandler)
router.post('/users',                    createAdminHandler)
router.patch('/users/:id/toggle-active', toggleAdminHandler)
router.delete('/users/:id',              deleteAdminHandler)
router.post('/users/:id/reset-password', resetPasswordHandler)

export default router
