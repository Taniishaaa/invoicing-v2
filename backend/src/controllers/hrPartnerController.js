import {
  createHrPartner,
  getHrPartners,
  toggleHrPartnerStatus,
  deleteHrPartner,
  resetHrPartnerPassword,
  getInvoicesList,
  generateExcel,
  generateZip,
} from '../services/hrPartnerService.js'

export async function createHrPartnerHandler(req, res) {
  try {
    const result = await createHrPartner(req.body)
    return res.status(201).json({ success: true, message: 'HR Partner created successfully', ...result })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function getHrPartnersHandler(req, res) {
  try {
    const partners = await getHrPartners()
    return res.json({ success: true, partners })
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch HR Partners' })
  }
}

export async function toggleHrPartnerHandler(req, res) {
  try {
    await toggleHrPartnerStatus(req.params.id)
    return res.json({ success: true, message: 'Status updated successfully' })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function deleteHrPartnerHandler(req, res) {
  try {
    await deleteHrPartner(req.params.id)
    return res.json({ success: true, message: 'HR Partner deleted successfully' })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function resetHrPartnerPasswordHandler(req, res) {
  try {
    const credentials = await resetHrPartnerPassword(req.params.id)
    return res.json({ success: true, credentials })
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }
}

export async function getHrInvoicesHandler(req, res) {
  try {
    const { page = 1, pageSize = 50, ...filters } = req.query
    const result = await getInvoicesList(filters, Number(page), Number(pageSize))
    return res.json({ success: true, ...result })
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
