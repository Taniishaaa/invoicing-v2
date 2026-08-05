import { createAdmin, getAdmins, toggleAdminStatus, deleteAdmin, resetPassword, getDashboardStats, getFunnel } from '../services/adminService.js'
import { buildInvoiceWhere, fetchInvoices, generateZip } from '../services/exportService.js'

export async function createAdminHandler(req, res) {
  try {
    const admin = await createAdmin(req.body)
    return res.status(201).json({ success: true, message: 'Admin created successfully', admin })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function getAdminsHandler(req, res) {
  try {
    const admins = await getAdmins()
    return res.json({ success: true, admins })
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch admins' })
  }
}

export async function toggleAdminHandler(req, res) {
  try {
    await toggleAdminStatus(req.params.id, req.user.id)
    return res.json({ success: true, message: 'Status updated successfully' })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function deleteAdminHandler(req, res) {
  try {
    await deleteAdmin(req.params.id, req.user.id)
    return res.json({ success: true, message: 'Admin deleted successfully' })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function resetPasswordHandler(req, res) {
  try {
    const credentials = await resetPassword(req.params.id)
    return res.json({ success: true, credentials })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function getDashboardHandler(req, res) {
  try {
    const stats = await getDashboardStats()
    return res.json({ success: true, stats })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function getFunnelHandler(req, res) {
  try {
    const funnel = await getFunnel()

    return res.json({
      success: true,
      funnel,
    })
  } catch (err) {
    console.error("GET FUNNEL ERROR");
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getInvoicesHandler(req, res) {
  try {
    const { page = 1, pageSize = 50, ...filters } = req.query
    const where  = buildInvoiceWhere(filters)
    const result = await fetchInvoices(where, Number(page), Number(pageSize))
    return res.json({ success: true, ...result })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function exportZipHandler(req, res) {
  try {
    const { invoiceIds } = req.body
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0)
      return res.status(400).json({ success: false, message: 'No invoice IDs provided' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="invoices_${Date.now()}.zip"`)
    await generateZip(invoiceIds, res)
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}
