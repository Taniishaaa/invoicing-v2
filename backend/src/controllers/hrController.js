import {
  getHrDashboardStats,
  getHrInvoices,
  getHrWorklist,
  verifyInvoice,
  reviewInvoice,
  approveInvoice,
  rejectInvoice,
  getInvoiceHrLog,
  generateExcel,
  generateZip,
  bulkHrAction
} from '../services/hrService.js'

export async function getHrDashboardHandler(req, res) {
  try {
    const stats = await getHrDashboardStats()
    return res.json({ success: true, stats })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function getHrInvoicesHandler(req, res) {
  try {
    const { page = 1, pageSize = 50, ...filters } = req.query
    const result = await getHrInvoices(filters, Number(page), Number(pageSize))
    return res.json({ success: true, ...result })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function getHrWorklistHandler(req, res) {
  try {

    const { mode } = req.query

    const invoices =
      await getHrWorklist(
        mode,
        req.user
      )

    return res.json({
      success: true,
      invoices
    })

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

export async function verifyInvoiceHandler(req, res) {
  try {

    await verifyInvoice(
      req.params.id,
      req.user.id,
      req.body.remarks
    )

    return res.json({
      success: true,
      message: 'Invoice verified'
    })

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

export async function reviewInvoiceHandler(req, res) {
  try {

    await reviewInvoice(
      req.params.id,
      req.user.id,
      req.body.remarks
    )

    return res.json({
      success: true,
      message: 'Invoice reviewed'
    })

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

export async function approveInvoiceHandler(req, res) {
  try {
    await approveInvoice(req.params.id, req.user.id, req.body.remarks)
    return res.json({ success: true, message: 'Invoice approved' })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function rejectInvoiceHandler(req, res) {
  try {
    await rejectInvoice(req.params.id, req.user.id, req.body.remarks)
    return res.json({ success: true, message: 'Invoice rejected' })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function getHrLogHandler(req, res) {
  try {
    const log = await getInvoiceHrLog(req.params.id)
    return res.json({ success: true, log })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function hrExportExcelHandler(req, res) {
  try {
    const buffer = await generateExcel(req.query)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="invoices_${Date.now()}.xlsx"`)
    return res.send(buffer)
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function hrExportZipHandler(req, res) {
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

export async function bulkAction(req, res)
{
    try
    {
        const result =
            await bulkHrAction(
                req.params.batchId,
                req.params.action,
                req.user.id,
                req.body?.remarks
            )

        return res.json({
            success: true,
            ...result
        })
    }
    catch (err)
    {
        return res.status(400).json({
            success: false,
            message: err.message
        })
    }
}
