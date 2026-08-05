import prisma from '../config/prisma.js'
import {
  uploadFile,
  deleteFile,
  downloadFile,
  getFileStream,
} from "./s3Service.js";

import { S3_FOLDERS } from "../constants/s3Folders.js";
import archiver from 'archiver'

// ── Internal supporting documents (BatchSupportingDocument) ───────────────────

export async function uploadInternalDoc({ batchId, uploadedById, stage, title, remarks, file }) {
  const batch = await prisma.uploadBatch.findUnique({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')

  const { key } = await uploadFile({
  batch,
  folder: S3_FOLDERS.INTERNAL_DOCS,
  fileId: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
  buffer: file.buffer,
  contentType: file.mimetype,
  extension: "",
});

  return prisma.batchSupportingDocument.create({
    data: {
      uploadBatchId: batchId,
      uploadedById,
      stage,
      title,
      originalFileName: file.originalname,
      filePath: key,
      mimeType: file.mimetype,
      fileSize: file.size,
      remarks: remarks ?? null,
    },
    include: { uploadedBy: { select: { id: true, name: true } } }
  })
}

export async function listInternalDocs(batchId, stageFilter) {
  const where = { uploadBatchId: batchId }
  if (stageFilter) where.stage = stageFilter
  return prisma.batchSupportingDocument.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: { uploadedBy: { select: { id: true, name: true, role: true } } }
  })
}

export async function viewInternalDoc(docId, res) {

  const doc =
    await prisma.batchSupportingDocument.findUnique({
      where: { id: docId }
    })

  if (!doc)
    throw new Error("Document not found")

  const stream =
    await getFileStream(doc.filePath)

  res.setHeader(
    "Content-Type",
    doc.mimeType ?? "application/octet-stream"
  )

  res.setHeader(
    "Content-Disposition",
    `inline; filename="${doc.originalFileName}"`
  )

  stream.pipe(res)

}

export async function deleteInternalDoc(docId, requesterId) {
  const doc = await prisma.batchSupportingDocument.findUnique({ where: { id: docId } })
  if (!doc) throw new Error('Document not found')
  await prisma.batchSupportingDocument.delete({ where: { id: docId } })
  try {
  await deleteFile(doc.filePath)
}
catch (err) {
  console.error(err)
}
}

export async function downloadInternalDocs(batchId, res) {
  const docs =
    await prisma.batchSupportingDocument.findMany({
      where: {
        uploadBatchId: batchId
      }
    })

  if (docs.length === 0) {
    throw new Error(
      'No internal documents found'
    )
  }

  res.attachment(
    `internal-documents-${batchId}.zip`
  )

  const archive = archiver(
    'zip',
    {
      zlib: { level: 9 }
    }
  )

  archive.pipe(res)

  for (const doc of docs) {
    const buffer =
  await downloadFile(doc.filePath)

archive.append(buffer, {
  name: `${doc.stage}/${doc.originalFileName}`
})
  }

  await archive.finalize()
}

const INCLUDE = {
  hrPartner: {
    select: {
      id: true,
      name: true,
      pan: true
    }
  },

  uploadedBy: {
    select: {
      id: true,
      name: true,
      username: true
    }
  },

  _count: {
    select: {
      invoices: true,
      vendorDocuments: true
    }
  }
}

export async function downloadBatchPdfs(batchId, res) {
  const batch = await prisma.uploadBatch.findUnique({
    where: { id: batchId },
    include: {
      invoices: {
        where: {
          isDeleted: false
        }
      }
    }
  })

  if (!batch)
    throw new Error('Batch not found')

  res.setHeader(
    'Content-Type',
    'application/zip'
  )

  res.setHeader(
    'Content-Disposition',
    `attachment; filename=batch-${batchId}-pdfs.zip`
  )

 const archive = archiver('zip', {
  zlib: { level: 9 }
})

  archive.pipe(res)

  for (const invoice of batch.invoices) {
    const buffer =
  await downloadFile(invoice.pdfPath)

archive.append(buffer, {
  name:
    invoice.originalFileName ??
    `${invoice.id}.pdf`
})
  }

  await archive.finalize()
}

export async function listBatches({ role, userId, mode, hrPartnerId, project, nature, status, dateFrom, dateTo, invoiceNumber, page = 1, pageSize = 50 }) {
  const where = {}

  if (role === 'vendor') {
    const partner = await prisma.hrPartner.findUnique({ where: { userId } })
    if (!partner) return { batches: [], total: 0 }
    where.hrPartnerId = partner.id
  } 
   else {
    if (hrPartnerId) where.hrPartnerId = hrPartnerId
  }

  if (mode === 'maker') {
  where.invoices = {
    some: {
      isDeleted: false,
      extractionStatus: 'completed',
      status: {
        is: {
          currentStage: 'extracted'
        }
      }
    }
  }
}

else if (mode === 'checker') {
  where.invoices = {
    some: {
      isDeleted: false,
      extractionStatus: 'completed',
      status: {
        is: {
          currentStage: 'hr_maker_verified'
        }
      }
    }
  }
}

else if (mode === 'approver') {
  where.invoices = {
    some: {
      isDeleted: false,
      extractionStatus: 'completed',
      status: {
        is: {
          currentStage: 'hr_checker_reviewed'
        }
      }
    }
  }
}

  if (project) where.project = project
  if (nature) where.nature = nature
  if (status) where.status = status

  if (invoiceNumber) {
    const invoiceNumberFilter = {
      invoiceNumber: {
        contains: invoiceNumber,
        mode: 'insensitive'
      }
    }

    where.invoices = {
      some: {
        ...(where.invoices?.some ?? { isDeleted: false }),
        ...invoiceNumberFilter
      }
    }
  }

  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z')
  }

  const [batches, total] = await Promise.all([
    prisma.uploadBatch.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.uploadBatch.count({ where })
  ])

  return { batches, total }
}

export async function getBatchDetail(id) {
  return prisma.uploadBatch.findUnique({
    where: { id },

    include: {
      hrPartner: {
        select: {
          id: true,
          name: true,
          pan: true
        }
      },

      uploadedBy: {
        select: {
          id: true,
          name: true,
          username: true
        }
      },

      vendorDocuments: {
        select: {
          id: true,
          documentName: true,
          originalFileName: true,
          filePath: true,
          mimeType: true,
          fileSize: true,
          createdAt: true
        },

        orderBy: {
          createdAt: 'asc'
        }
      },

      supportingDocuments: {
        orderBy: { createdAt: 'asc' },
        include: { uploadedBy: { select: { id: true, name: true, role: true } } }
      },

    invoices: {
  where: {
    isDeleted: false
  },

  select: {
    id: true,
    invoiceNumber: true,
    invoiceDate: true,
    invoiceValue: true,
    extractionStatus: true,
    project: true,
    nature: true,
    originalFileName: true,

    creditNotes: {
      where: {
        isDeleted: false,
        extractionStatus: 'completed'
      },

      select: {
        id: true,
        creditNoteNumber: true,
        creditNoteDate: true,
        creditNoteValue: true
      },

      orderBy: {
        createdAt: 'asc'
      }
    },

    status: {
  select: {
    hrStatus: true,
    complianceStatus: true,
    financeStatus: true,
    paymentStatus: true,
    currentStage: true,
    requiresCompliance: true
  }
}
  },

  orderBy: {
    createdAt: 'asc'
  }
}

   
    }
  })
}

export async function getBatchSupportingDocuments(batchId) {
  return prisma.vendorSupportingDocument.findMany({
    where: {
      uploadBatchId: batchId
    },

    orderBy: {
      createdAt: 'asc'
    },

    select: {
  id: true,
  documentName: true,
  originalFileName: true,
  filePath: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,

  creditNoteId: true,

  creditNote: {
    select: {
      id: true,
      creditNoteNumber: true
    }
  }
}
  })
}

export async function viewSupportingDocument(
  id,
  res
) {

  const doc =
    await prisma.vendorSupportingDocument.findUnique({
      where: { id }
    })

  if (!doc)
    throw new Error("Document not found")

  const stream =
    await getFileStream(doc.filePath)

  res.setHeader(
    "Content-Type",
    doc.mimeType ?? "application/octet-stream"
  )

  res.setHeader(
    "Content-Disposition",
    `inline; filename="${doc.originalFileName}"`
  )

  stream.pipe(res)

}

export async function downloadSupportingDocs(
  batchId,
  res
) {
  const batch =
    await prisma.uploadBatch.findUnique({
      where: {
        id: batchId
      },
      include: {
        vendorDocuments: true
      }
    })

  if (!batch)
    throw new Error('Batch not found')

  if (batch.vendorDocuments.length === 0) {
  return res.status(404).json({
    success: false,
    message: 'No supporting documents found'
  })
}

  res.attachment(
    `supporting-documents-${batchId}.zip`
  )

  const archive = archiver(
    'zip',
    {
      zlib: { level: 9 }
    }
  )

  archive.pipe(res)

  for (
    const doc of batch.vendorDocuments
  ) {
    const buffer =
  await downloadFile(doc.filePath)

archive.append(buffer, {
  name: doc.originalFileName
})
  }

  await archive.finalize()
}

