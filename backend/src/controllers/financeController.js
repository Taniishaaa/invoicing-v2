import {
  getFinanceDashboardStats,
  getFinanceInvoices,
  clearInvoice,
  rejectInvoiceFinance,
  markPayment,
  bulkMarkPayment,
  getInvoiceFinanceLog,
  generateExcel,
  generateZip,
  getFinanceWorklist,
  verifyFinanceInvoice,
  bulkFinanceAction,
  getFinancePaymentFilters
} from '../services/financeService.js'
import {
  generatePaymentTemplate,
  previewPaymentImport,
  confirmPaymentImport
} from '../services/paymentService.js'
import multer from 'multer'

export const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

export async function getFinanceDashboardHandler(req, res) {
  try {
    const stats = await getFinanceDashboardStats()
    return res.json({ success: true, stats })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function getFinanceInvoicesHandler(req, res) {
  try {
    const { page = 1, pageSize = 50, ...filters } = req.query
    const result = await getFinanceInvoices(filters, Number(page), Number(pageSize))
    return res.json({ success: true, ...result })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function clearInvoiceHandler(req, res) {
  try {
    await clearInvoice(req.params.id, req.user.id, req.body.remarks)
    return res.json({ success: true, message: 'Invoice cleared' })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function rejectInvoiceFinanceHandler(req, res) {
  try {
    await rejectInvoiceFinance(req.params.id, req.user.id, req.body.remarks)
    return res.json({ success: true, message: 'Invoice rejected' })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function markPaymentHandler(
  req,
  res
) {

  try {

    await markPayment(

      req.params.batchId,

      req.user.id,

      req.body

    )

    return res.json({

      success: true,

      message: 'Payment marked successfully'

    })

  }

  catch (err) {

    return res.status(400).json({

      success: false,

      message: err.message

    })

  }

}

export async function bulkMarkPaymentHandler(
  req,
  res
) {

  try {

    const result =
      await bulkMarkPayment(

        req.body.batchIds,

        req.user.id,

        req.body

      )

    return res.json({

      success: true,

      ...result

    })

  }

  catch (err) {

    return res.status(400).json({

      success: false,

      message: err.message

    })

  }

}

export async function getFinanceLogHandler(req, res) {
  try {
    const log = await getInvoiceFinanceLog(req.params.id)
    return res.json({ success: true, log })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function financeExportExcelHandler(req, res) {
  try {
    const buffer = await generateExcel(req.query)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="invoices_${Date.now()}.xlsx"`)
    return res.send(buffer)
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function financeExportZipHandler(req, res) {
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

export async function getFinanceWorklistHandler(
  req,
  res
) {

  try {

    const {
  mode,
  ...filters
} = req.query

const batches =
  await getFinanceWorklist(
    filters,
    mode,
    req.user
  )

    return res.json({
      success: true,
      batches
    })

  }

  catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message
    })

  }

}

export async function paymentFilters(req, res, next) {

    try {
        const data = await getFinancePaymentFilters()
        res.json({
            success: true,
            ...data
        })
    }

    catch (err) {
        next(err)
    }
}

export async function verifyFinanceInvoiceHandler(req, res) {
  try {
    await verifyFinanceInvoice(req.params.id, req.user.id, req.body.remarks)
    return res.json({ success: true, message: 'Invoice verified' })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function generatePaymentTemplateHandler(req, res) {
  try {
    const buffer = await generatePaymentTemplate(req.query)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="payment_template_${Date.now()}.xlsx"`)
    return res.send(buffer)
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function previewPaymentImportHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' })
    const result = await previewPaymentImport(req.file.buffer)
    return res.json({ success: true, ...result })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function confirmPaymentImportHandler(req, res) {
  try {
    const { rows } = req.body
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, message: 'No rows to confirm' })
    const result = await confirmPaymentImport(rows, req.user.id)
    return res.json({ success: true, ...result })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function bulkFinanceActionHandler(
  req,
  res
) {

  try {

    const result =
      await bulkFinanceAction(
        req.params.batchId,
        req.body.action,
        req.user.id,
        req.body.remarks
      )

    return res.json({
      success: true,
      ...result
    })

  }

  catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message
    })

  }

}