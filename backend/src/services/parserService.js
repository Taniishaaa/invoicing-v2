import axios from 'axios'
import { downloadFile } from './s3Service.js'
import prisma           from '../config/prisma.js'

const PARSER_URL = process.env.PARSER_URL || 'http://localhost:8002'

//Call the Python parser for a single invoice.
export async function callParser({
  pdfPath,
  vendorPan,
  serviceGroup,
  nature,
  isCreditNote = false
}) {

  // Download the PDF from S3
  const pdfBuffer = await downloadFile(pdfPath)

  // Convert to Base64 for FastAPI
  const pdfBytes = pdfBuffer.toString('base64')

  const response = await axios.post(
    `${PARSER_URL}/parse`,
    {
      pdfBytes,
      vendorPan,
      serviceGroup,
      nature,
      isCreditNote
    },
    {
      timeout: 120000
    }
  )

  return response.data
}

function calculateShortExcess(result) {
  const taxable  = Number(result.taxable_amount ?? 0)
  const cgst     = Number(result.cgst_amount    ?? 0)
  const sgst     = Number(result.sgst_amount    ?? 0)
  const igst     = Number(result.igst_amount    ?? 0)
  const invValue = Number(result.invoice_value  ?? 0)

  if (!taxable || !invValue) return { shortAmount: null, excessAmount: null }

  const calculated = taxable + cgst + sgst + igst
  const diff       = Math.round((invValue - calculated) * 100) / 100  // 2 decimal places

  if (diff > 0) {
    // Invoice value > calculated → vendor billed more → SHORT (we owe less than billed)
    return { shortAmount: diff, excessAmount: null }
  } else if (diff < 0) {
    // Invoice value < calculated → vendor billed less → EXCESS (we owe more than billed)
    return { shortAmount: null, excessAmount: Math.abs(diff) }
  }

  return { shortAmount: null, excessAmount: null }
}

/**
 * Process a single invoice record through the parser and update the DB.
 */
export async function processInvoice(
  id,
  vendorPan,
  type = 'invoice'
) {

  try {
    if (type === 'credit_note') {
      await prisma.creditNote.update({
        where: { id },
        data: {
          extractionStatus: 'processing'
        }
      })
    }
    else {
      await prisma.invoice.update({
        where: { id },
        data: {
          extractionStatus: 'processing'
        }
      })
    }

    const record =
      type === 'credit_note'
        ? await prisma.creditNote.findUnique({
            where: { id }
          })
        : await prisma.invoice.findUnique({
            where: { id },
            include: {
              uploadBatch: true,
              status: true
            }
          })

    if (!record) {
      throw new Error(`${type} not found`)
    }

    const result = await callParser({
      pdfPath: record.pdfPath,
      vendorPan,
      serviceGroup: type === 'invoice' ? record.project : null,
      nature: type === 'invoice' ? record.nature : null,
      isCreditNote: type === 'credit_note'
    })

    if (!result.success) {
      await _markFailed(
        id,
        result.error,
        type
      )
      return
    }

    if (type === 'credit_note') {

      await processCreditNoteResult(
        id,
        record,
        result
      )
      return
    }

    // -------------------------------
    // Invoice Flow
    // -------------------------------

    const duplicate =
      await prisma.invoice.findFirst({
        where: {
          hrPartnerId: record.hrPartnerId,
          invoiceNumber: result.invoice_number,
          isDeleted: false,
          id: {
            not: id
          }
        }
      })

    if (duplicate) {

      await _markFailed(
        id,
        `Duplicate invoice number: ${result.invoice_number} already exists for this HR Partner`,
        'invoice'
      )

      return
    }

    await prisma.invoice.update({
      where: { id },
      data: {
        extractionStatus: 'completed',
        extractionError: null,
        rawExtraction: result.raw_extraction,

        invoiceNumber: result.invoice_number,
        irn: result.irn,

        invoiceDate:
          result.invoice_date
            ? new Date(result.invoice_date)
            : null,

        hrPartnerGstin: result.hr_partner_gstin,
        hrPartnerPan: result.hr_partner_pan,
        hrPartnerState: result.hr_partner_state,
        hrPartnerAddress: result.hr_partner_address,

        sbossName: result.sboss_name,
        sbossGstin: result.sboss_gstin,
        sbossPan: result.sboss_pan,
        sbossState: result.sboss_state,
        sbossAddress: result.sboss_address,

        taxableAmount: result.taxable_amount,
        cgstAmount: result.cgst_amount,
        sgstAmount: result.sgst_amount,
        igstAmount: result.igst_amount,
        invoiceValue: result.invoice_value,

        ...calculateShortExcess(result),

        description: result.description
      }
    })

    await prisma.invoiceStatus.upsert({
      where: {
        invoiceId: id
      },

      create: {
        invoiceId: id,
        requiresCompliance: record.nature !== 'bgv',
        currentStage: 'extracted',
        hrStatus: 'pending',
        financeStatus: 'pending',
        complianceStatus: 'pending',
        paymentStatus: 'unpaid'
      },

      update: {
        requiresCompliance: record.nature !== 'bgv',
        currentStage: 'extracted',
        hrStatus: 'pending'
      }
    })

    await updateBatchProgress(
      record.uploadBatchId
    )
  }
  catch (err) {
    await _markFailed(
      id,
      err.message,
      type
    )
  }
}

async function processCreditNoteResult(
  creditNoteId,
  creditNote,
  result
) {

  const normalizedInvoiceNumber =
    result.original_invoice_number
      ?.trim()
      ?.replace(/^INV[:\s-]*/i, '')

  const originalInvoice =
    await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          equals: normalizedInvoiceNumber,
          mode: 'insensitive'
        },
        hrPartnerId: creditNote.hrPartnerId,
        isDeleted: false,
        type: 'regular'
      }
    })

  if (!originalInvoice) {

    await prisma.creditNote.update({
      where: {
        id: creditNoteId
      },
      data: {
        extractionStatus: 'failed',
        extractionError:
          `Referenced invoice "${result.original_invoice_number}" was not found`
      }
    })

    return
  }

 const duplicateCreditNote =
await prisma.creditNote.findFirst({
  where: {
    creditNoteNumber: result.invoice_number,
    hrPartnerId: creditNote.hrPartnerId,
    id: {
      not: creditNoteId
    }
  }
})

  if (duplicateCreditNote) {

    await prisma.creditNote.update({
      where: {
        id: creditNoteId
      },
      data: {
        extractionStatus: 'failed',
        extractionError:
          `Credit note ${result.credit_note_number} already exists`
      }
    })

    return
  }

  await prisma.creditNote.update({
  where: {
    id: creditNoteId
  },

  data: {
    extractionStatus: 'completed',
    extractionError: null,

    originalInvoiceId: originalInvoice.id,
    uploadBatchId: originalInvoice.uploadBatchId,

    creditNoteNumber: result.invoice_number,
    originalInvoiceNumber: result.original_invoice_number,

    creditNoteDate: result.invoice_date
      ? new Date(result.invoice_date)
      : null,

    taxableAmount: result.taxable_amount,
    cgstAmount: result.cgst_amount,
    sgstAmount: result.sgst_amount,
    igstAmount: result.igst_amount,

    creditNoteValue: result.invoice_value,

    description: result.description,

    rawExtraction: result.raw_extraction
  }
})

  await updateBatchProgress(
    originalInvoice.uploadBatchId
  )
}

async function _markFailed(
  id,
  error,
  type = 'invoice'
) {

  console.error(
    `[Parser] ✗ ${type} ${id}: ${error}`
  )

  if (type === 'credit_note') {

    await prisma.creditNote.update({
      where: { id },

      data: {
        extractionStatus:
          'failed',

        extractionError:
          error
      }
    })
    return
  }

  const invoice =
    await prisma.invoice.update({
      where: { id },

      data: {
        extractionStatus:
          'failed',

        extractionError:
          error
      },

      select: {
        uploadBatchId: true
      }
    })

  await updateBatchProgress(
    invoice.uploadBatchId
  )
}

export async function updateBatchProgress(batchId) {
  const invoices = await prisma.invoice.findMany({
    where: {
      uploadBatchId: batchId,
      isDeleted: false
    },
    select: {
      extractionStatus: true
    }
  })

  const total = invoices.length

  const processed = invoices.filter(
    i => i.extractionStatus === 'completed'
  ).length

  const failed = invoices.filter(
    i => i.extractionStatus === 'failed'
  ).length

  let status = 'uploaded'

  if (total === 0) {
    status = 'uploaded'
  }
  else if (processed === total) {
    status = 'completed'
  }
  else if (failed === total) {
    status = 'failed'
  }
  else if (processed > 0 && failed > 0) {
    status = 'partially_completed'
  }
  else {
    status = 'processing'
  }

  await prisma.uploadBatch.update({
    where: {
      id: batchId
    },
    data: {
      totalFiles: total,
      processedFiles: processed,
      failedFiles: failed,
      status
    }
  })

}
