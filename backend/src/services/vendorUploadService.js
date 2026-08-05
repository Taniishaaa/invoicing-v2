import { uploadFile, deleteFile } from "./s3Service.js";
import { S3_FOLDERS } from "../constants/s3Folders.js";
import path from "path";
import crypto from "crypto";
import {
  processInvoice,
  updateBatchProgress
} from './parserService.js'
import { getUploadLock }  from './systemService.js'
import prisma from "../config/prisma.js";

// ── In-process queue ───────────────────────────────────────────────────────────
const queue     = []
let   isRunning = false

function enqueue(id, vendorPan, type = 'invoice') {
  queue.push({
    id,
    vendorPan,
    type
  })

  runQueue()
}

async function runQueue() {
  if (isRunning) return
  isRunning = true
  while (queue.length > 0) {
    const {
  id,
  vendorPan,
  type
} = queue.shift()
    try {
     await processInvoice(
  id,
  vendorPan,
  type
)
    } catch (err) {
      console.error(`[Queue] Error for invoice ${id}:`, err.message)
    }
  }
  isRunning = false
}

// ── Upload invoices ────────────────────────────────────────────────────────────
export async function uploadInvoices({
  userId,
  project,
  nature,
  files,
  supportingDocuments = []
}) {

  const lock = await getUploadLock()
  if (lock.isLocked) {
    throw new Error(
      `Uploads are currently locked${lock.reason ? ': ' + lock.reason : ''}. Please contact your administrator.`
    )
  }

  if (!project || !nature) 
    throw new Error('Project and Nature are required')
  
  if (!files?.length)       throw new Error('Please upload at least one PDF')
  if (files.length > 60) throw new Error('Maximum 60 files allowed per upload')
    if (supportingDocuments.length > 10)
  throw new Error('Maximum 10 supporting documents allowed')

  const hrPartner = await prisma.hrPartner.findUnique({ where: { userId } })
  if (!hrPartner) throw new Error('HR Partner not found')

  const batch = await prisma.uploadBatch.create({
    data: {
      hrPartnerId:  hrPartner.id,
      uploadedById: userId,
      totalFiles:   files.length,
      project,
      nature,
    }
  })

for (const file of supportingDocuments) {

  const { key } = await uploadFile({
  batch,
  folder: S3_FOLDERS.VENDOR_SUPPORTING_DOCUMENTS,
  fileId: crypto.randomUUID(),
  buffer: file.buffer,
  contentType: file.mimetype,
  extension: path.extname(file.originalname)
})

  await prisma.vendorSupportingDocument.create({
    data: {
      uploadBatchId: batch.id,
      uploadedById: userId,

      documentName: path.parse(file.originalname).name,
      originalFileName: file.originalname,

      filePath: key,

      mimeType: file.mimetype,
      fileSize: file.size
    }
  })
}

  const invoiceIds = []

 for (const file of files) {
  const invoice = await prisma.invoice.create({
    data: {
      uploadBatchId: batch.id,
      hrPartnerId: hrPartner.id,
      project,
      nature,
      pdfPath: "", // Updated after successful S3 upload
      extractionStatus: "pending",
    },
  });

  try {
    const { key } = await uploadFile({
      batch,
      folder: S3_FOLDERS.INVOICES,
      fileId: invoice.id,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    await prisma.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        pdfPath: key,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    });

    invoiceIds.push(invoice.id);
  } catch (err) {
    // Roll back the invoice if upload fails
    await prisma.invoice.delete({
      where: {
        id: invoice.id,
      },
    });

    throw new Error(
      `Failed to upload "${file.originalname}" to storage.`
    );
  }
}

  for (const invoiceId of invoiceIds) {
    enqueue(
  invoiceId,
  hrPartner.pan,
  'invoice'
)
  }

 return {
  batchId: batch.id,
  uploadedFiles: files.length,
  supportingDocuments:
    supportingDocuments.length,

  invoicesCreated:
    invoiceIds.length,

  message:
    'Invoices uploaded successfully. Extraction is running in the background.'
}
}

// ── Delete invoice ─────────────────────────────────────────────────────────────
export async function deleteInvoice(invoiceId, userId) {

  const hrPartner = await prisma.hrPartner.findUnique({
    where: { userId }
  })

  if (!hrPartner)
    throw new Error('HR Partner not found')

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { status: true }
  })

  if (!invoice)
    throw new Error('Invoice not found')

  if (invoice.hrPartnerId !== hrPartner.id)
    throw new Error('Access denied')

  if (invoice.isDeleted)
    throw new Error('Invoice already deleted')

  if (invoice.status?.hrStatus === 'approved')
    throw new Error('Cannot delete an HR-approved invoice')

  if (invoice.status?.financeStatus === 'cleared')
    throw new Error('Cannot delete a finance-cleared invoice')

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      isDeleted: true,
      deletedAt: new Date()
    }
  })

  await updateBatchProgress(invoice.uploadBatchId)

  await prisma.invoiceActivity.create({
    data: {
      invoiceId,
      userId,
      action: 'VENDOR_DELETED',
      remarks: 'Deleted by vendor',
      role: 'vendor'
    }
  })

  await deleteFile(invoice.pdfPath)
}

// ── Re-upload invoice ──────────────────────────────────────────────────────────
export async function reuploadInvoice(invoiceId, userId, file) {

  const hrPartner = await prisma.hrPartner.findUnique({ where: { userId } })
  if (!hrPartner) throw new Error('HR Partner not found')

  const invoice = await prisma.invoice.findUnique({
    where:   { id: invoiceId },
    include: { status: true },
  })

  if (!invoice)                             throw new Error('Invoice not found')
  if (invoice.hrPartnerId !== hrPartner.id) throw new Error('Access denied')
  if (invoice.isDeleted)                    throw new Error('Invoice is deleted')
  if (invoice.status?.hrStatus === 'approved')
    throw new Error('Cannot re-upload an HR-approved invoice')
  if (invoice.status?.financeStatus === 'cleared')
    throw new Error('Cannot re-upload a finance-cleared invoice')

  // Save new file
 await deleteFile(invoice.pdfPath)

const batch = await prisma.uploadBatch.findUnique({
  where: {
    id: invoice.uploadBatchId
  }
})

if (!batch) {
  throw new Error("Upload batch not found")
}

const { key } = await uploadFile({
  batch,
  folder: S3_FOLDERS.INVOICES,
  fileId: invoice.id,
  buffer: file.buffer,
  contentType: file.mimetype
})

  // Reset invoice for re-processing
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      pdfPath: key,
      extractionStatus: 'pending',
      extractionError:  null,
      rawExtraction:    null,
      invoiceNumber:    null,
      irn:              null,
      invoiceDate:      null,
      hrPartnerGstin:   null,
      hrPartnerPan:     null,
      hrPartnerState:   null,
      sbossName:        null,
      sbossGstin:       null,
      sbossPan:         null,
      sbossState:       null,
      taxableAmount:    null,
      cgstAmount:       null,
      sgstAmount:       null,
      igstAmount:       null,
      invoiceValue:     null,
      description:      null,
    }
  })

  await updateBatchProgress(invoice.uploadBatchId)

  if (invoice.status) {
    await prisma.invoiceStatus.update({
      where: { invoiceId },
      data:  { hrStatus: 'pending', financeStatus: 'pending', hrRemarks: null, financeRemarks: null }
    })
  }

  await prisma.invoiceActivity.create({
    data: { invoiceId, userId, action: 'VENDOR_REUPLOADED', remarks: 'PDF re-uploaded by vendor — sent back to parser', role: 'vendor' }
  })

  enqueue(
  invoiceId,
  hrPartner.pan,
  invoice.type === 'credit_note'
    ? 'credit_note'
    : 'invoice'
)

  return { message: 'Invoice re-uploaded and queued for processing' }
}

// ── Get vendor invoices ────────────────────────────────────────────────────────
export async function getVendorInvoices(userId, filters = {}, page = 1, pageSize = 50) {

  const hrPartner = await prisma.hrPartner.findUnique({ where: { userId } })
  if (!hrPartner) throw new Error('HR Partner not found')

  const where = { hrPartnerId: hrPartner.id, isDeleted: false }

  if (filters.extractionStatus) where.extractionStatus = filters.extractionStatus
  if (filters.project)          where.project          = filters.project
  if (filters.nature)           where.nature           = filters.nature
  if (filters.hrStatus || filters.paymentStatus) {
    where.status = {}
    if (filters.hrStatus)      where.status.hrStatus      = filters.hrStatus
    if (filters.paymentStatus) where.status.paymentStatus = filters.paymentStatus
  }

  const skip = (page - 1) * pageSize
  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take:    pageSize,
      orderBy: { createdAt: 'desc' },
      include: { status: true, uploadBatch: { select: { project: true, nature: true, createdAt: true } } },
    }),
    prisma.invoice.count({ where }),
  ])

  return { invoices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getVendorDashboardStats(userId) {
  const hrPartner = await prisma.hrPartner.findUnique({
    where: { userId }
  })

  if (!hrPartner) {
    throw new Error('HR Partner not found')
  }

  const [
    uploaded,
    failed,
    paid,
    paymentPending,
    recentBatches
  ] = await Promise.all([
    prisma.invoice.count({
      where: {
        hrPartnerId: hrPartner.id,
        isDeleted: false
      }
    }),

    prisma.invoice.count({
      where: {
        hrPartnerId: hrPartner.id,
        isDeleted: false,
        extractionStatus: 'failed'
      }
    }),

    prisma.invoice.count({
      where: {
        hrPartnerId: hrPartner.id,
        isDeleted: false,
        status: {
          paymentStatus: 'paid'
        }
      }
    }),

    prisma.invoice.count({
      where: {
        hrPartnerId: hrPartner.id,
        isDeleted: false,
        extractionStatus: 'completed',
        status: {
          paymentStatus: 'unpaid'
        }
      }
    }),

    prisma.uploadBatch.findMany({
      where: {
        hrPartnerId: hrPartner.id
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    })
  ])

  return {
    uploaded,
    failed,
    paymentPending,
    paid,

    recentBatches: recentBatches.map(b => ({
      id: b.id,
      project: b.project,
      nature: b.nature,
      totalFiles: b.totalFiles,
      processedFiles: b.processedFiles,
      failedFiles: b.failedFiles,
      createdAt: b.createdAt
    }))
  }
}

// ── Upload credit notes ────────────────────────────────────────────────────────
export async function uploadCreditNotes({
  userId,
  files,
  supportingDocuments = []
}) {

  const lock = await getUploadLock()

  if (lock.isLocked) {
    throw new Error(
      `Uploads are currently locked${
        lock.reason ? ': ' + lock.reason : ''
      }. Please contact your administrator.`
    )
  }

  if (!files?.length)
    throw new Error('Please upload at least one PDF')

  if (files.length >60)
    throw new Error('Maximum 60 files allowed per upload')

  if (supportingDocuments.length > 10)
    throw new Error('Maximum 10 supporting documents allowed')

  const hrPartner = await prisma.hrPartner.findUnique({
    where: { userId }
  })

  if (!hrPartner)
    throw new Error('HR Partner not found')

  const creditNoteIds = []

  for (const file of files) {

    // Create DB record first
    const creditNote = await prisma.creditNote.create({
      data: {
        hrPartnerId: hrPartner.id,
        pdfPath: "",
        extractionStatus: "pending"
      }
    })

    try {

      // Credit notes don't belong to a batch initially,
      // so use the credit note itself as the storage grouping.
      const pseudoBatch = {
        id: creditNote.id,
        createdAt: creditNote.createdAt
      }

      const { key } = await uploadFile({
        batch: pseudoBatch,
        folder: S3_FOLDERS.CREDIT_NOTES,
        fileId: creditNote.id,
        buffer: file.buffer,
        contentType: file.mimetype
      })

      await prisma.creditNote.update({
        where: {
          id: creditNote.id
        },
        data: {
          pdfPath: key,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size
        }
      })

      creditNoteIds.push(creditNote.id)

      // Upload supporting documents
      for (const doc of supportingDocuments) {

        const { key: docKey } = await uploadFile({
          batch: pseudoBatch,
          folder: S3_FOLDERS.VENDOR_SUPPORTING_DOCUMENTS,
          fileId: crypto.randomUUID(),
          buffer: doc.buffer,
          contentType: doc.mimetype,
          extension: path.extname(doc.originalname)
        })

        await prisma.vendorSupportingDocument.create({
          data: {
            creditNoteId: creditNote.id,
            uploadedById: userId,

            documentName: path.parse(doc.originalname).name,
            originalFileName: doc.originalname,

            filePath: docKey,

            mimeType: doc.mimetype,
            fileSize: doc.size
          }
        })
      }

    } catch (err) {

      // Roll back DB record if upload fails
      await prisma.creditNote.delete({
        where: {
          id: creditNote.id
        }
      })

      throw new Error(
        `Failed to upload "${file.originalname}" to storage.`
      )
    }
  }

  for (const creditNoteId of creditNoteIds) {
    enqueue(
      creditNoteId,
      hrPartner.pan,
      'credit_note'
    )
  }

  return {
    uploadedFiles: files.length,
    supportingDocuments: supportingDocuments.length,
    creditNotesCreated: creditNoteIds.length,
    message: 'Credit notes uploaded successfully. Extraction is running in the background.'
  }
}

export async function getVendorCreditNotes(userId) {

  const hrPartner =
    await prisma.hrPartner.findUnique({
      where: { userId }
    })

  if (!hrPartner)
    throw new Error(
      'HR Partner not found'
    )

  return prisma.creditNote.findMany({
    where: {
      hrPartnerId: hrPartner.id,
      isDeleted: false
    },

    include: {
      originalInvoice: {
        select: {
          id: true,
          invoiceNumber: true,
          uploadBatchId: true
        }
      },

      uploadBatch: {
        select: {
          id: true,
          project: true,
          nature: true
        }
      }
    },

    orderBy: {
      createdAt: 'desc'
    }
  })
}
