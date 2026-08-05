import { listBatches, getBatchDetail, downloadBatchPdfs,
  getBatchSupportingDocuments,
  viewSupportingDocument, downloadSupportingDocs,
  uploadInternalDoc, listInternalDocs, viewInternalDoc, deleteInternalDoc, downloadInternalDocs } from '../services/batchService.js'

export async function getBatches(req, res) {
  try {
    const {mode, hrPartnerId, project, nature, status, dateFrom, dateTo, invoiceNumber, page, pageSize } = req.query
    const result = await listBatches({
      role: req.user.role,
      userId: req.user.id,
      mode,
      hrPartnerId, project, nature, status, dateFrom, dateTo, invoiceNumber,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50
    })
    res.json({ success: true, ...result })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to fetch batches' })
  }
}

export async function getBatch(req, res) {
  try {
    const batch = await getBatchDetail(req.params.id)
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' })
    res.json({ success: true, batch })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to fetch batch' })
  }
}

export async function downloadBatchPdfsHandler(
  req,
  res
) {
  try {
    await downloadBatchPdfs(
      req.params.id,
      res
    )
  }
  catch (err) {
    console.error(err)
    res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

export async function getSupportingDocsHandler(
  req,
  res
) {
  try {
    const docs =
      await getBatchSupportingDocuments(
        req.params.id
      )

    res.json({
      success: true,
      documents: docs
    })
  }
  catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    })
  }
}

export async function viewSupportingDocHandler(
  req,
  res
) {
  try {
    await viewSupportingDocument(
      req.params.id,
      res
    )
  }
  catch (err) {
    res.status(404).json({
      success: false,
      message: err.message
    })
  }
}

export async function downloadSupportingDocsHandler(req, res) {
  try {
    await downloadSupportingDocs(req.params.id, res)
  } catch (err) {
    console.error(err)
    res.status(400).json({ success: false, message: err.message })
  }
}

// ── Internal supporting documents ─────────────────────────────────────────────

const ROLE_STAGE = {
  hr_team:         'hr',
  compliance_team: 'compliance',
  finance_team:    'finance',
}

export async function uploadInternalDocHandler(req, res) {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' })
    const { title, remarks, stage: bodyStage } = req.body
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' })

    const stage = ROLE_STAGE[req.user.role] ?? bodyStage
    if (!stage) return res.status(400).json({ success: false, message: 'Stage is required' })

    const doc = await uploadInternalDoc({
      batchId: req.params.id,
      uploadedById: req.user.id,
      stage,
      title,
      remarks,
      file,
    })
    return res.status(201).json({ success: true, document: doc })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function listInternalDocsHandler(req, res) {
  try {
    const { stage } = req.query
    const docs = await listInternalDocs(req.params.id, stage)
    return res.json({ success: true, documents: docs })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function viewInternalDocHandler(req, res) {
  try {
    await viewInternalDoc(req.params.docId, res)
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message })
  }
}

export async function deleteInternalDocHandler(req, res) {
  try {
    await deleteInternalDoc(req.params.docId, req.user.id)
    return res.json({ success: true })
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
}

export async function downloadInternalDocsHandler(
  req,
  res
) {
  try {
    await downloadInternalDocs(
      req.params.id,
      res
    )
  }
  catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    })
  }
}
