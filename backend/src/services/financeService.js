import prisma from '../config/prisma.js'
import { buildInvoiceWhere, fetchInvoices, generateExcel, generateZip } from './exportService.js'

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

// ── Dashboard stats ────────────────────────────────────────────────────────────
export async function getFinanceDashboardStats() {

  const batches = await prisma.uploadBatch.findMany({

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

  const financeBatches = batches.filter(batch =>
    batch.invoices.some(inv =>
      inv.status &&
      (
        (
          inv.status.requiresCompliance &&
          [
            'compliance_verified',
            'finance_maker_verified',
            'finance_cleared',
            'paid'
          ].includes(inv.status.currentStage)
        )
        ||
        (
          !inv.status.requiresCompliance &&
          [
            'hr_approved',
            'finance_maker_verified',
            'finance_cleared',
            'paid'
          ].includes(inv.status.currentStage)
        )
      )
    )
  )

  const totalFinanceBatches = financeBatches.length

  const pendingClearance = financeBatches.filter(batch =>

    batch.invoices.some(inv =>

      inv.status &&
      (

        (
          inv.status.requiresCompliance &&
          [
            'compliance_verified',
            'finance_maker_verified'
          ].includes(inv.status.currentStage)
        )

        ||

        (
          !inv.status.requiresCompliance &&
          inv.status.currentStage === 'hr_approved'
        )

      )

    )

  ).length

  const clearedBatches = financeBatches.filter(batch => {

    const invoices = batch.invoices.filter(inv =>

      inv.status &&
      (
        inv.status.currentStage === 'finance_cleared' ||
        inv.status.currentStage === 'paid'
      )

    )

    return (
      invoices.length > 0 &&
      invoices.length === batch.invoices.length
    )

  }).length

  const paidBatches = financeBatches.filter(batch => {

    const invoices = batch.invoices.filter(inv =>
      inv.status?.paymentStatus === 'paid'
    )

    return (
      invoices.length > 0 &&
      invoices.length === batch.invoices.length
    )

  }).length

return {

  totalBatches: totalFinanceBatches,

  pendingBatches: pendingClearance,

  clearedBatches,

  paidBatches,

  batches: financeBatches.map(batch => {

    const actionableInvoices = batch.invoices.filter(inv =>
      inv.status &&
      (
        (
          inv.status.requiresCompliance &&
          [
            'compliance_verified',
            'finance_maker_verified',
            'finance_cleared',
            'paid'
          ].includes(inv.status.currentStage)
        ) ||
        (
          !inv.status.requiresCompliance &&
          [
            'hr_approved',
            'finance_maker_verified',
            'finance_cleared',
            'paid'
          ].includes(inv.status.currentStage)
        )
      )
    )

    const total = actionableInvoices.length

    const paid = actionableInvoices.filter(
      inv => inv.status?.paymentStatus === 'paid'
    ).length

    const cleared = actionableInvoices.filter(
      inv =>
        inv.status?.currentStage === 'finance_cleared' ||
        inv.status?.currentStage === 'paid'
    ).length

    let status = 'pending_clearance'

    if (total > 0 && paid === total)
      status = 'paid'

    else if (total > 0 && cleared === total)
      status = 'cleared'

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

// ── Get invoices for Finance (compliance verified only) ───────────────────────────────
export async function getFinanceInvoices(
  filters,
  page,
  pageSize
) {

  const where =
    buildInvoiceWhere(filters)

  where.extractionStatus =
    'completed'

  where.OR = [

    // Normal invoices
    {
      nature: {
        not: 'bgv'
      },

      status: {
        complianceStatus: 'verified'
      }
    },

    // BGV invoices
    {
      nature: 'bgv',

      status: {
        currentStage: 'hr_approved'
      }
    }

  ]

  return fetchInvoices(
    where,
    page,
    pageSize
  )

}

// ── Clear invoice ──────────────────────────────────────────────────────────────
export async function clearInvoice(
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
    'finance_maker_verified'
  ) {
    throw new Error(
      'Invoice is not pending finance checker clearance'
    )
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({
      where: {
        invoiceId
      },

      data: {
        financeStatus:
          'cleared',

        currentStage:
          'finance_cleared',

        financeCheckerId:
          userId,

        financeCheckerAt:
          new Date(),

        financeCheckerRemarks:
          remarks ?? null
      }
    }),

    prisma.invoiceActivity.create({
      data: {
        invoiceId,
        userId,

        action:
          'FINANCE_CLEARED',

        remarks:
          remarks ?? null,

        role:
          'finance_team'
      }
    })
  ])
}

// ── Reject invoice (finance) ───────────────────────────────────────────────────
export async function rejectInvoiceFinance(
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
    'FINANCE_REJECTED'

  if (
    currentStage ===
    'compliance_verified'
  ) {
    action =
      'FINANCE_MAKER_REJECTED'
  }

  else if (
    currentStage ===
    'finance_maker_verified'
  ) {
    action =
      'FINANCE_CHECKER_REJECTED'
  }

  const updateData = {
    financeStatus: 'rejected',
    currentStage: 'rejected'
  }

  if (
    currentStage ===
    'compliance_verified'
  ) {
    updateData.financeMakerId =
      userId

    updateData.financeMakerAt =
      new Date()

    updateData.financeMakerRemarks =
      remarks
  }

  else {

    updateData.financeCheckerId =
      userId

    updateData.financeCheckerAt =
      new Date()

    updateData.financeCheckerRemarks =
      remarks
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({
      where: {
        invoiceId
      },
      data: updateData
    }),

    prisma.invoiceActivity.create({
      data: {
        invoiceId,
        userId,

        action,

        remarks,

        role:
          'finance_team'
      }
    })
  ])
}

// ── Mark payment (UTR + date) ──────────────────────────────────────────────────
export async function markPayment(
  batchId,
  userId,
  {
    utrNumber,
    paymentDate
  }
) {

  if (!utrNumber?.trim())
    throw new Error('UTR number is required')

  if (!paymentDate)
    throw new Error('Payment date is required')

  const batch =
    await prisma.uploadBatch.findUnique({

      where: {
        id: batchId
      },

      include: {

        invoices: {

          where: {
            isDeleted: false,
            extractionStatus: 'completed'
          },

          include: {
            status: true
          }

        }

      }

    })

  if (!batch)
    throw new Error('Batch not found')

  const invoicesToPay =
    batch.invoices.filter(inv =>
      inv.status &&
      inv.status.financeStatus === 'cleared' &&
      inv.status.paymentStatus === 'unpaid'
    )

  if (invoicesToPay.length === 0)
    throw new Error(
      'No finance-cleared unpaid invoices found in this batch'
    )

  await prisma.$transaction(

    invoicesToPay.flatMap(inv => [

      prisma.invoiceStatus.update({

        where: {
          invoiceId: inv.id
        },

        data: {

          paymentStatus: 'paid',

          currentStage: 'paid',

          paymentReferenceId:
            utrNumber.trim(),

          paymentDate:
            new Date(paymentDate),

          paymentUpdatedById:
            userId

        }

      }),

      prisma.invoiceActivity.create({

        data: {

          invoiceId: inv.id,

          userId,

          action:
            'PAYMENT_MARKED',

          remarks:
            `UTR: ${utrNumber.trim()} | Date: ${paymentDate}`,

          role:
            'finance_team'

        }

      })

    ])

  )

  return {

    processed:
      invoicesToPay.length

  }

}

// ── Bulk mark payment ──────────────────────────────────────────────────────────
export async function bulkMarkPayment(
  batchIds,
  userId,
  {
    utrNumber,
    paymentDate
  }
) {

  if (!Array.isArray(batchIds) || batchIds.length === 0)
    throw new Error('No batches selected')

  const results = {

    success: [],

    failed: []

  }

  for (const batchId of batchIds) {

    try {

      await markPayment(

        batchId,

        userId,

        {
          utrNumber,
          paymentDate
        }

      )

      results.success.push(batchId)

    }

    catch (err) {

      results.failed.push({

        batchId,

        reason:
          err.message

      })

    }

  }

  return results

}

// ── Get activity log for an invoice (Finance entries only) ────────────────────
export async function getInvoiceFinanceLog(invoiceId) {
  return prisma.invoiceActivity.findMany({
    where:   { invoiceId, role: 'finance_team' },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, username: true } } },
  })
}

export async function getFinanceWorklist(
  filters,
  mode,
  user
) {

   if (
    !['finance_maker', 'finance_checker'].includes(user.subRole)
  ) {
    throw new Error('Unauthorized')
  }

  if (
    !['maker', 'checker', 'payment'].includes(mode)
  ) {
    return []
  }

  const where = {
    invoices: {
      some: {}
    }
  }

  if (filters.hrPartnerId) {
    where.hrPartnerId = filters.hrPartnerId
  }

  if (filters.project) {
    where.project = filters.project
  }

  if (filters.nature) {
    where.nature = filters.nature
  }

 if (filters.dateFrom || filters.dateTo) {

  where.createdAt = {}

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom)
    from.setHours(0, 0, 0, 0)

    where.createdAt.gte = from
  }

  if (filters.dateTo) {
    const to = new Date(filters.dateTo)
    to.setHours(23, 59, 59, 999)

    where.createdAt.lte = to
  }

}

  let invoiceFilter

  if (mode === 'maker') {

    invoiceFilter = {

      isDeleted: false,

      extractionStatus: 'completed',

      OR: [

        {
          status: {
            is: {
              requiresCompliance: true,
              currentStage: 'compliance_verified'
            }
          }
        },

        {
          status: {
            is: {
              requiresCompliance: false,
              currentStage: 'hr_approved'
            }
          }
        }

      ]

    }

  }

  else if (mode === 'checker') {

    invoiceFilter = {

      isDeleted: false,

      extractionStatus: 'completed',

      status: {
        is: {
          currentStage: 'finance_maker_verified'
        }
      }

    }

  }

  else if (mode === 'payment') {

  const batches = await prisma.uploadBatch.findMany({

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

  const paymentBatches = batches

  .map(batch => {

    const actionableInvoices =
      batch.invoices.filter(inv =>
        inv.status &&
        (
          inv.status.currentStage === 'finance_cleared' ||
          inv.status.currentStage === 'paid'
        )
      )

    if (actionableInvoices.length === 0)
      return null

    const total =
      actionableInvoices.length

    const cleared =
      actionableInvoices.filter(inv =>
        inv.status.currentStage === 'finance_cleared'
      ).length

    const paid =
      actionableInvoices.filter(inv =>
        inv.status.paymentStatus === 'paid'
      ).length

    return {

      id: batch.id,

      batchNumber:
        `B-${batch.createdAt.getFullYear()}${String(batch.createdAt.getMonth() + 1).padStart(2, '0')}${String(batch.createdAt.getDate()).padStart(2, '0')}-${batch.id.slice(-6).toUpperCase()}`,

      hrPartner: batch.hrPartner,

      project: batch.project,

      nature: batch.nature,

      createdAt: batch.createdAt,

      total,

      cleared,

      paid,

      paymentStatus:
        paid === total
          ? 'paid'
          : 'pending'

    }

  })

  .filter(Boolean)

let result = paymentBatches

if (
  filters.paymentStatus &&
  filters.paymentStatus !== 'all'
) {

  result = result.filter(
    batch =>
      batch.paymentStatus === filters.paymentStatus
  )

}

return result

}

  else {

    return []

  }

  where.invoices.some = invoiceFilter

  return prisma.uploadBatch.findMany({

    where,

    include: INCLUDE,

    orderBy: {
      createdAt: 'desc'
    }

  })

}

export async function getFinancePaymentFilters() {

 const vendors = await prisma.hrPartner.findMany({
  select: {
    id: true,
    name: true
  },
  orderBy: {
    name: 'asc'
  }
})

  return {
    vendors
  }

}

export async function verifyFinanceInvoice(
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

  const allowedStage =

    (
      invoice.nature !== 'bgv' &&
      invoice.status?.currentStage ===
      'compliance_verified'
    )

    ||

    (
      invoice.nature === 'bgv' &&
      invoice.status?.currentStage ===
      'hr_approved'
    )

  if (!allowedStage) {
    throw new Error(
      'Invoice is not pending finance maker verification'
    )
  }

  await prisma.$transaction([

    prisma.invoiceStatus.update({

      where: {
        invoiceId
      },

      data: {

        financeStatus:
          'maker_verified',

        currentStage:
          'finance_maker_verified',

        financeMakerId:
          userId,

        financeMakerAt:
          new Date(),

        financeMakerRemarks:
          remarks ?? null

      }

    }),

    prisma.invoiceActivity.create({

      data: {

        invoiceId,

        userId,

        action:
          'FINANCE_MAKER_VERIFIED',

        remarks:
          remarks ?? null,

        role:
          'finance_team'

      }

    })

  ])

}

export async function bulkFinanceAction(
  batchId,
  action,
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
    throw new Error(
      'Batch not found'
    )

  let processed = 0

  for (const invoice of batch.invoices) {

    try {

      if (action === 'verify') {

        const canVerify =

          (
            invoice.nature !== 'bgv' &&
            invoice.status?.currentStage ===
            'compliance_verified'
          )

          ||

          (
            invoice.nature === 'bgv' &&
            invoice.status?.currentStage ===
            'hr_approved'
          )

        if (
          invoice.extractionStatus ===
            'completed' &&
          canVerify
        ) {

          await verifyFinanceInvoice(
            invoice.id,
            userId,
            remarks
          )

          processed++

        }

      }

      else if (
        action === 'clear'
      ) {

        if (

          invoice.extractionStatus ===
            'completed' &&

          invoice.status?.currentStage ===
            'finance_maker_verified'

        ) {

          await clearInvoice(
            invoice.id,
            userId,
            remarks
          )

          processed++

        }

      }

      else if (
        action === 'reject'
      ) {

        if (
          invoice.status?.currentStage !==
          'rejected'
        ) {

          await rejectInvoiceFinance(
            invoice.id,
            userId,
            remarks
          )

          processed++

        }

      }

    }

    catch {

      // Skip invalid invoices

    }

  }

  return {

    processed,

    total:
      batch.invoices.length

  }

}

export { generateExcel, generateZip, buildInvoiceWhere }
