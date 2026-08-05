import {
  getComplianceDashboardStats,
  getComplianceInvoices,
  getComplianceWorklist,
  verifyComplianceInvoice,
  rejectComplianceInvoice,
  getInvoiceComplianceLog,
  generateExcel,
  generateZip,
  bulkComplianceVerify
} from '../services/complianceService.js'

// ── Dashboard ────────────────────────────────────────────────────────────────
export async function getComplianceDashboardHandler(
  req,
  res
) {
  try {

    const stats =
      await getComplianceDashboardStats()

    return res.json({
      success: true,
      stats
    })

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

// ── Invoice List ─────────────────────────────────────────────────────────────
export async function getComplianceInvoicesHandler(
  req,
  res
) {
  try {

    const {
      page = 1,
      pageSize = 50,
      ...filters
    } = req.query

    const result =
      await getComplianceInvoices(
        filters,
        Number(page),
        Number(pageSize)
      )

    return res.json({
      success: true,
      ...result
    })

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

// ── Worklist ─────────────────────────────────────────────────────────────────
export async function getComplianceWorklistHandler(req, res) {
  try {

    const {
      page = 1,
      pageSize = 50,
      ...filters
    } = req.query

    const batches =
      await getComplianceWorklist(
        filters,
        Number(page),
        Number(pageSize)
      )

    return res.json({
      success: true,
      ...batches
    })

  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

// ── Verify ───────────────────────────────────────────────────────────────────
export async function verifyComplianceInvoiceHandler(
  req,
  res
) {
  try {

    await verifyComplianceInvoice(
      req.params.id,
      req.user.id,
      req.body.remarks
    )

    return res.json({
      success: true,
      message:
        'Invoice verified'
    })

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

// ── Reject ───────────────────────────────────────────────────────────────────
export async function rejectComplianceInvoiceHandler(
  req,
  res
) {
  try {

    await rejectComplianceInvoice(
      req.params.id,
      req.user.id,
      req.body.remarks
    )

    return res.json({
      success: true,
      message:
        'Invoice rejected'
    })

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

// ── Bulk Verify ───────────────────────────────────────────────────────────────
export async function bulkComplianceVerifyHandler(
  req,
  res
) {
  try {

    const result =
      await bulkComplianceVerify(
        req.params.id,
        req.user.id,
        req.body?.remarks
      )

    return res.json({
      success: true,
      ...result
    })

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

// ── Activity Log ─────────────────────────────────────────────────────────────
export async function getComplianceLogHandler(
  req,
  res
) {
  try {

    const log =
      await getInvoiceComplianceLog(
        req.params.id
      )

    return res.json({
      success: true,
      log
    })

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

// ── Excel Export ─────────────────────────────────────────────────────────────
export async function complianceExportExcelHandler(
  req,
  res
) {
  try {

    const buffer =
      await generateExcel(req.query)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoices_${Date.now()}.xlsx"`
    )

    return res.send(buffer)

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

// ── ZIP Export ───────────────────────────────────────────────────────────────
export async function complianceExportZipHandler(
  req,
  res
) {
  try {

    const { invoiceIds } =
      req.body

    if (
      !Array.isArray(invoiceIds) ||
      invoiceIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'No invoice IDs provided'
      })
    }

    res.setHeader(
      'Content-Type',
      'application/zip'
    )

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoices_${Date.now()}.zip"`
    )

    await generateZip(
      invoiceIds,
      res
    )

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    })
  }
}