import prisma from '../config/prisma.js'
import {
  buildInvoiceWhere,
  fetchInvoices,
  generateExcel,
  generateZip
} from './exportService.js'

// ── Dashboard stats ────────────────────────────────────────────────────────────
export async function getComplianceDashboardStats() {

  const [
    complianceBatches,
    pendingComplianceBatches,
    verifiedBatches,
    batches
  ] = await Promise.all([

    // Total batches that reached Compliance
    prisma.uploadBatch.count({
      where: {
        invoices: {
          some: {
            isDeleted: false,
            extractionStatus: 'completed',

            status: {
              is: {
                requiresCompliance: true
              }
            }
          }
        }
      }
    }),

    // Batches waiting for compliance verification
    prisma.uploadBatch.count({
      where: {
        invoices: {
          some: {
            isDeleted: false,
            extractionStatus: 'completed',

            status: {
              is: {
                currentStage: 'hr_approved',
                requiresCompliance: true
              }
            }
          }
        }
      }
    }),

    // Batches whose compliance work is complete
    prisma.uploadBatch.count({
      where: {
        invoices: {
          some: {
            isDeleted: false,
            extractionStatus: 'completed',

            status: {
              is: {
                requiresCompliance: true
              }
            }
          },

          none: {
            isDeleted: false,
            extractionStatus: 'completed',

            status: {
              is: {
                requiresCompliance: true,
                complianceStatus: 'pending'
              }
            }
          }
        }
      }
    }),

    // Dashboard table (only pending batches)
    prisma.uploadBatch.findMany({
      where: {
  invoices: {
    some: {
      isDeleted: false,
      extractionStatus: 'completed',

      status: {
        is: {
          requiresCompliance: true
        }
      }
    }
  }
},

      include: {
        hrPartner: {
          select: {
            name: true
          }
        },

        invoices: {
          where: {
            isDeleted: false,
            extractionStatus: 'completed'
          },

          include: {
            status: true
          }
        }
      },

      orderBy: {
        createdAt: 'desc'
      }
    })

  ])

  return {
    complianceBatches,
    pendingComplianceBatches,
    verifiedBatches,

  batches: batches.map(batch => {

  const complianceInvoices =
    batch.invoices.filter(
      i => i.status?.requiresCompliance
    )

  const total = complianceInvoices.length

  const verified =
    complianceInvoices.filter(
      i => i.status?.complianceStatus === 'verified'
    ).length

  const rejected =
    complianceInvoices.filter(
      i => i.status?.complianceStatus === 'rejected'
    ).length

  const pending =
    complianceInvoices.filter(
      i => i.status?.complianceStatus === 'pending'
    ).length

  let status = 'pending_verification'

  if (verified === total)
    status = 'verified'

  else if (pending > 0 && verified > 0)
    status = 'partially_verified'

  else if (rejected === total)
    status = 'rejected'

  return {
    id: batch.id,
    hrPartner: batch.hrPartner?.name ?? '—',
    project: batch.project,
    nature: batch.nature,
    status,
    createdAt: batch.createdAt
  }
})
  }
}

// ── Get invoices ───────────────────────────────────────────────────────────────
export async function getComplianceInvoices(
  filters,
  page,
  pageSize
) {

  const where =
    buildInvoiceWhere(filters)

  where.extractionStatus =
    'completed'

  where.status = {
  ...where.status,

  hrStatus: 'approved',
  complianceStatus: 'pending',
  requiresCompliance: true
}

  return fetchInvoices(
    where,
    page,
    pageSize
  )
}

// ── Compliance worklist (Batches) ─────────────────────────────────────────────
export async function getComplianceWorklist(
  filters,
  page = 1,
  pageSize = 50
) {

  const where = {

    invoices: {
      some: {
        isDeleted: false,

        extractionStatus: 'completed',

        status: {
          is: {
            currentStage: 'hr_approved',
            requiresCompliance: true
          }
        }
      }
    }

  }

  if (filters.hrPartnerId)
    where.hrPartnerId = filters.hrPartnerId

  if (filters.project)
    where.project = filters.project

  if (filters.nature)
    where.nature = filters.nature

  if (filters.status)
    where.status = filters.status

  if (filters.dateFrom || filters.dateTo) {

    where.createdAt = {}

    if (filters.dateFrom)
      where.createdAt.gte = new Date(filters.dateFrom)

    if (filters.dateTo)
      where.createdAt.lte = new Date(
        filters.dateTo + 'T23:59:59.999Z'
      )
  }

  const [batches, total] = await Promise.all([

    prisma.uploadBatch.findMany({

      where,

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

        _count: {
          select: {
            invoices: true,
            vendorDocuments: true
          }
        }

      },

      orderBy: {
        createdAt: 'desc'
      },

      skip: (page - 1) * pageSize,

      take: pageSize

    }),

    prisma.uploadBatch.count({
      where
    })

  ])

  return {
    batches,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

// ── Verify invoice ─────────────────────────────────────────────────────────────
export async function verifyComplianceInvoice(
  invoiceId,
  userId,
  remarks
) {

  const invoice =
    await prisma.invoice.findUnique({

      where: {
        id: invoiceId,
        isDeleted: false
      },

      include: {
        status: true
      }
    })

  if (!invoice) {
    throw new Error(
      'Invoice not found'
    )
  }

  if (!invoice.status?.requiresCompliance) {
    throw new Error(
        'Compliance verification is not required for this invoice'
    )
}

  if (
    invoice.status?.currentStage !==
    'hr_approved'
  ) {
    throw new Error(
      'Invoice is not pending compliance verification'
    )
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({

      where: {
        invoiceId
      },

      data: {

        complianceStatus:
          'verified',

        currentStage:
          'compliance_verified',

        complianceUserId:
          userId,

        complianceAt:
          new Date(),

        complianceRemarks:
          remarks ?? null
      }
    }),

    prisma.invoiceActivity.create({

      data: {
        invoiceId,
        userId,

        action:
          'COMPLIANCE_VERIFIED',

        remarks:
          remarks ?? null,

        role:
          'compliance_team'
      }
    })
  ])
}

// ── Reject invoice ─────────────────────────────────────────────────────────────
export async function rejectComplianceInvoice(
  invoiceId,
  userId,
  remarks
) {

  if (!remarks?.trim()) {
    throw new Error(
      'Remarks are required when rejecting'
    )
  }

  const invoice =
    await prisma.invoice.findUnique({

      where: {
        id: invoiceId,
        isDeleted: false
      },

      include: {
        status: true
      }
    })

  if (!invoice) {
    throw new Error(
      'Invoice not found'
    )
  }

  if (!invoice.status?.requiresCompliance) {
    throw new Error(
        'Compliance verification is not required for this invoice'
    )
}

  if (
    invoice.status?.currentStage !==
    'hr_approved'
  ) {
    throw new Error(
      'Invoice is not pending compliance verification'
    )
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({

      where: {
        invoiceId
      },

      data: {

        complianceStatus:
          'rejected',

        currentStage:
          'rejected',

        complianceUserId:
          userId,

        complianceAt:
          new Date(),

        complianceRemarks:
          remarks
      }
    }),

    prisma.invoiceActivity.create({

      data: {
        invoiceId,
        userId,

        action:
          'COMPLIANCE_REJECTED',

        remarks,

        role:
          'compliance_team'
      }
    })
  ])
}

// ── Bulk Verify Batch ─────────────────────────────────────────────────────────
export async function bulkComplianceVerify(
  batchId,
  userId,
  remarks
) {

  const batch =
    await prisma.uploadBatch.findUnique({

      where: {
        id: batchId
      },

      include: {
        invoices: {
          where: {
            isDeleted: false
          },

          include: {
            status: true
          }
        }
      }
    })

  if (!batch)
    throw new Error('Batch not found')

  let processed = 0

  for (const invoice of batch.invoices) {

    try {

      if (
        invoice.extractionStatus === 'completed' &&
        invoice.status?.currentStage === 'hr_approved' &&
        invoice.status?.requiresCompliance
      ) {

        await verifyComplianceInvoice(
          invoice.id,
          userId,
          remarks
        )

        processed++
      }

    }
    catch {
      // Skip invalid invoices
    }
  }

  return {
    processed,
    total: batch.invoices.filter(
      i => i.status?.requiresCompliance
    ).length
  }
}

// ── Compliance log ─────────────────────────────────────────────────────────────
export async function getInvoiceComplianceLog(
  invoiceId
) {

  return prisma.invoiceActivity.findMany({

    where: {
      invoiceId,
      role:
        'compliance_team'
    },

    orderBy: {
      createdAt:
        'desc'
    },

    include: {
      user: {
        select: {
          name: true,
          username: true
        }
      }
    }
  })
}

export {
  generateExcel,
  generateZip,
  buildInvoiceWhere,
}