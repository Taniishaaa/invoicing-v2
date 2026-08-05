import {
  uploadInvoices,
  uploadCreditNotes,
  getVendorInvoices,
  deleteInvoice,
  reuploadInvoice,
  getVendorDashboardStats,
  getVendorCreditNotes
} from '../services/vendorUploadService.js'

export async function uploadInvoicesHandler(req, res) {
  try {
  const result = await uploadInvoices({
  userId: req.user.id,
  project: req.body.project,
  nature: req.body.nature,

  files:
    req.files?.invoices ?? [],

  supportingDocuments:
    req.files?.supportingDocuments ?? []
})

    return res.status(201).json({ success: true, ...result })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function uploadCreditNotesHandler(req, res) {
  try {
    const result = await uploadCreditNotes({
      userId: req.user.id,

      files:
        req.files?.creditNotes ??
        req.files?.invoices ??
        [],

      supportingDocuments:
        req.files?.supportingDocuments ??
        []
    })

    return res.status(201).json({
      success: true,
      ...result
    })
  }
  catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    })
  }
}

export async function getVendorInvoicesHandler(req, res) {
  try {
    const { page = 1, pageSize = 50, ...filters } = req.query
    const result = await getVendorInvoices(req.user.id, filters, Number(page), Number(pageSize))
    return res.json({ success: true, ...result })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function deleteInvoiceHandler(req, res) {
  try {
    await deleteInvoice(req.params.id, req.user.id)
    return res.json({ success: true, message: 'Invoice deleted' })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function reuploadInvoiceHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' })
    const result = await reuploadInvoice(req.params.id, req.user.id, req.file)
    return res.json({ success: true, ...result })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function dashboard(req, res) {
  try {
    const stats = await getVendorDashboardStats(req.user.id)

    res.json({
      success: true,
      stats
    })
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

export async function getVendorCreditNotesHandler(
  req,
  res
) {
  try {

    const creditNotes =
      await getVendorCreditNotes(
        req.user.id
      )

    res.json({
      success: true,
      creditNotes
    })

  } catch (err) {

    res.status(400).json({
      success: false,
      message: err.message
    })

  }
}
