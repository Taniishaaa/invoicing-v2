import prisma from '../config/prisma.js'
import { buildInvoiceWhere, fetchInvoices, generateExcel, generateZip } from './exportService.js'

// ── Dashboard stats ────────────────────────────────────────────────────────────
export async function getHrDashboardStats() {

  const [
    pendingApproval,
    approved,
    totalRejected,
    batches
  ] = await Promise.all([

    prisma.invoiceStatus.count({
      where: {
        hrStatus: {
          not: 'rejected'
        },

        currentStage: {
          in: [
            'extracted',
            'hr_maker_verified',
            'hr_checker_reviewed'
          ]
        },

        invoice: {
          isDeleted: false,
          extractionStatus: 'completed'
        }
      }
    }),

    prisma.invoiceStatus.count({
      where: {
        hrStatus: 'approved'
      }
    }),

    prisma.invoiceStatus.count({
      where: {
        hrStatus: 'rejected'
      }
    }),

    prisma.uploadBatch.findMany({
      include: {
        hrPartner: {
          select: {
            name: true
          }
        },

        invoices: {
          where: {
            isDeleted: false
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

  const dashboardBatches =
    batches.map(batch => {

      const actionableInvoices =
  batch.invoices.filter(
    i => i.extractionStatus === 'completed'
  )

const total =
  actionableInvoices.length

const approvedCount =
  actionableInvoices.filter(
    i => i.status?.hrStatus === 'approved'
  ).length

const rejectedCount =
  actionableInvoices.filter(
    i => i.status?.hrStatus === 'rejected'
  ).length

const pendingCount =
  total -
  approvedCount -
  rejectedCount

let status = 'pending_approval'

if (total === 0) {
  status = 'failed'
}

else if (approvedCount === total) {
  status = 'approved'
}

else if (rejectedCount === total) {
  status = 'rejected'
}

else if (
  approvedCount > 0 &&
  pendingCount > 0
) {
  status = 'partially_approved'
}

else if (
  approvedCount > 0 &&
  rejectedCount > 0
) {
  status = 'partially_approved'
}

else if (
  approvedCount > 0
) {
  status = 'partially_approved'
}
      return {
        id: batch.id,

        hrPartner:
          batch.hrPartner?.name ?? '—',

        project:
          batch.project,

        nature:
          batch.nature,

        status,

        createdAt:
          batch.createdAt
      }
    })

  return {
    pendingApproval,
    approved,
    totalRejected,

    batches:
      dashboardBatches
  }
}

// ── Get invoices for HR (completed extractions + failed) ──────────────────────
export async function getHrInvoices(filters, page, pageSize) {
  const where = buildInvoiceWhere(filters)
  // HR sees completed and failed extractions
  where.extractionStatus = { in: ['completed', 'failed'] }
  return fetchInvoices(where, page, pageSize)
}

// ── Approve invoice ────────────────────────────────────────────────────────────
export async function approveInvoice(
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

  if (!invoice)
    throw new Error('Invoice not found')

  if (
    invoice.extractionStatus !==
    'completed'
  ) {
    throw new Error(
      'Only successfully extracted invoices can be approved'
    )
  }

  if (
    invoice.status?.currentStage !==
    'hr_checker_reviewed'
  ) {
    throw new Error(
      'Invoice is not pending HR approval'
    )
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({
      where: {
        invoiceId
      },

      data: {
  hrStatus: 'approved',
  currentStage: 'hr_approved',

  hrApprovedById: userId,
  hrApprovedAt: new Date(),

  hrRemarks: remarks ?? null,

  complianceStatus: 'pending',
  financeStatus: 'pending'
}
    }),

    prisma.invoiceActivity.create({
      data: {
        invoiceId,
        userId,

        action:
          'HR_APPROVED',

        remarks:
          remarks ?? null,

        role:
          'hr_team'
      }
    }),
  ])
}

// ── Reject invoice ─────────────────────────────────────────────────────────────
export async function rejectInvoice(
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

  if (!invoice)
    throw new Error('Invoice not found')

  const currentStage =
    invoice.status?.currentStage

  let action =
    'HR_REJECTED'

  if (
    currentStage ===
    'extracted'
  ) {
    action =
      'HR_MAKER_REJECTED'
  }

  else if (
    currentStage ===
    'hr_maker_verified'
  ) {
    action =
      'HR_CHECKER_REJECTED'
  }

  else if (
    currentStage ===
    'hr_checker_reviewed'
  ) {
    action =
      'HR_APPROVER_REJECTED'
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({
      where: {
        invoiceId
      },

      data: {
        hrStatus:
          'rejected',

        currentStage:
          'rejected',

        hrRemarks:
          remarks,

        hrApprovedById:
          userId,

        hrApprovedAt:
          new Date(),
      }
    }),

    prisma.invoiceActivity.create({
      data: {
        invoiceId,
        userId,

        action,

        remarks,

        role:
          'hr_team'
      }
    }),
  ])
}

// ── Get activity log for an invoice (HR entries only) ─────────────────────────
export async function getInvoiceHrLog(invoiceId) {
  return prisma.invoiceActivity.findMany({
    where:   { invoiceId, role: 'hr_team' },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, username: true } } },
  })
}

export async function getHrWorklist(
  mode,
  user
) {

  // HR Approver can ONLY access approver queue
  if (user.subRole === 'hr_approver') {
    mode = 'approver'
  }

  // HR Maker / Checker can switch only
  else if (
    ['hr_maker', 'hr_checker'].includes(
      user.subRole
    )
  ) {

    if (!['maker', 'checker'].includes(mode)) {
      return []
    }

  }

  else {
    throw new Error('Unauthorized')
  }

  let targetStage

  if (mode === 'maker')
    targetStage = 'extracted'

  else if (mode === 'checker')
    targetStage = 'hr_maker_verified'

  else if (mode === 'approver')
    targetStage = 'hr_checker_reviewed'

  else
    return []

  return prisma.uploadBatch.findMany({

    where: {
      invoices: {
        some: {
          isDeleted: false,
          extractionStatus: 'completed',

          status: {
            is: {
              currentStage: targetStage
            }
          }
        }
      }
    },

    include: INCLUDE,

    orderBy: {
      createdAt: 'desc'
    }

  })

}

export async function verifyInvoice(
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

  if (!invoice)
    throw new Error('Invoice not found')

  if (
    invoice.extractionStatus !==
    'completed'
  ) {
    throw new Error(
      'Invoice extraction is not completed'
    )
  }

  if (
    invoice.status?.currentStage !==
    'extracted'
  ) {
    throw new Error(
      'Invoice is not pending maker verification'
    )
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({
      where: {
        invoiceId
      },

      data: {
        hrStatus:
          'maker_verified',

        currentStage:
          'hr_maker_verified',

        hrMakerId:
          userId,

        hrMakerAt:
          new Date(),

        hrMakerRemarks:
          remarks ?? null,
      }
    }),

    prisma.invoiceActivity.create({
      data: {
        invoiceId,
        userId,

        action:
          'HR_MAKER_VERIFIED',

        remarks:
          remarks ?? null,

        role:
          'hr_team'
      }
    }),
  ])
}

export async function reviewInvoice(
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

  if (!invoice)
    throw new Error('Invoice not found')

  if (
    invoice.extractionStatus !==
    'completed'
  ) {
    throw new Error(
      'Invoice extraction is not completed'
    )
  }

  if (
    invoice.status?.currentStage !==
    'hr_maker_verified'
  ) {
    throw new Error(
      'Invoice is not pending checker review'
    )
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({
      where: {
        invoiceId
      },

      data: {

        hrStatus:
          'checker_reviewed',

        currentStage:
          'hr_checker_reviewed',

        hrCheckerId:
          userId,

        hrCheckerAt:
          new Date(),

        hrCheckerRemarks:
          remarks ?? null,
      }
    }),

    prisma.invoiceActivity.create({
      data: {
        invoiceId,
        userId,

        action:
          'HR_CHECKER_REVIEWED',

        remarks:
          remarks ?? null,

        role:
          'hr_team'
      }
    }),
  ])
}

export async function bulkHrAction(
  batchId,
  action,
  userId,
  remarks
)
{
    const batch = await prisma.uploadBatch.findUnique({
        where: { id: batchId },
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

    for (const invoice of batch.invoices)
    {
        try
        {
            if (action === 'verify')
            {
                if (
                    invoice.extractionStatus === 'completed' &&
                    invoice.status?.currentStage === 'extracted'
                )
                {
                    await verifyInvoice(
                        invoice.id,
                        userId,
                        remarks
                    )
                    processed++
                }
            }

            else if (action === 'review')
            {
                if (
                    invoice.extractionStatus === 'completed' &&
                    invoice.status?.currentStage === 'hr_maker_verified'
                )
                {
                    await reviewInvoice(
                        invoice.id,
                        userId,
                        remarks
                    )
                    processed++
                }
            }

            else if (action === 'approve')
            {
                if (
                    invoice.extractionStatus === 'completed' &&
                    invoice.status?.currentStage === 'hr_checker_reviewed'
                )
                {
                    await approveInvoice(
                        invoice.id,
                        userId,
                        remarks
                    )
                    processed++
                }
            }

            else if (action === 'reject')
            {
                if (
                    invoice.status?.currentStage !== 'rejected'
                )
                {
                    await rejectInvoice(
                        invoice.id,
                        userId,
                        remarks
                    )
                    processed++
                }
            }
        }
        catch
        {
            // skip invalid invoices
        }
    }

    return {
        processed,
        total: batch.invoices.length
    }
}

export { generateExcel, generateZip, buildInvoiceWhere }
