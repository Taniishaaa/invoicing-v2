import { downloadFile } from "./s3Service.js"

import ExcelJS  from 'exceljs'
import { createRequire } from 'module'
const require  = createRequire(import.meta.url)
const archiver = require('archiver')

import prisma           from '../config/prisma.js'

// ── Shared invoice query builder ───────────────────────────────────────────────
export function buildInvoiceWhere(filters = {}) {
  const where = { isDeleted: false }

  if (filters.batchId) {
  where.uploadBatchId = filters.batchId
}

  if (filters.hrPartnerId)      where.hrPartnerId      = filters.hrPartnerId
  if (filters.project)          where.project          = filters.project
  if (filters.nature)           where.nature           = filters.nature
  if (filters.extractionStatus) where.extractionStatus = filters.extractionStatus
  if (filters.invoiceType)      where.type             = filters.invoiceType
  if (filters.invoiceNumber)    where.invoiceNumber    = { contains: filters.invoiceNumber, mode: 'insensitive' }

  if (filters.hrStatus || filters.financeStatus || filters.paymentStatus || filters.currentStage || filters.complianceStatus) {
    where.status = {}
    if (filters.hrStatus)         where.status.hrStatus         = filters.hrStatus
    if (filters.financeStatus)    where.status.financeStatus    = filters.financeStatus
    if (filters.paymentStatus)    where.status.paymentStatus    = filters.paymentStatus
    if (filters.currentStage)     where.status.currentStage     = filters.currentStage
    if (filters.complianceStatus) where.status.complianceStatus = filters.complianceStatus
  }

  if (filters.dateFrom || filters.dateTo) {
    where.invoiceDate = {}
    if (filters.dateFrom) where.invoiceDate.gte = new Date(filters.dateFrom)
    if (filters.dateTo)   where.invoiceDate.lte = new Date(filters.dateTo)
  }

  return where
}

export function buildCreditNoteWhere(filters = {}) {

  const where = {
    isDeleted: false,
    extractionStatus: "completed"
}

if (filters.batchId) {
  where.uploadBatchId = filters.batchId
}

  if (filters.hrPartnerId)
    where.hrPartnerId = filters.hrPartnerId

  if (filters.project)
    where.uploadBatch = {
      ...(where.uploadBatch || {}),
      project: filters.project
    }

  if (filters.nature)
    where.uploadBatch = {
      ...(where.uploadBatch || {}),
      nature: filters.nature
    }

  if (filters.dateFrom || filters.dateTo) {

    where.creditNoteDate = {}

    if (filters.dateFrom) {

      const from = new Date(filters.dateFrom)
      from.setHours(0,0,0,0)

      where.creditNoteDate.gte = from

    }

    if (filters.dateTo) {

      const to = new Date(filters.dateTo)
      to.setHours(23,59,59,999)

      where.creditNoteDate.lte = to

    }

  }

  return where

}

// ── Fetch invoices with all relations ─────────────────────────────────────────
export async function fetchInvoices(where, page = 1, pageSize = 50) {
  const skip = (page - 1) * pageSize

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take:    pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        hrPartner:   { select: { name: true, pan: true } },
        status:      true,
        uploadBatch: { select: { id: true, createdAt: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ])

  return { invoices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function fetchCreditNotes(where) {

  return prisma.creditNote.findMany({

    where,

    orderBy: {
      createdAt: 'desc'
    },

    include: {

      hrPartner: {

        select: {

          id: true,
          name: true,
          pan: true

        }

      },

      uploadBatch: {

        select: {

          id: true,
          project: true,
          nature: true,
          createdAt: true

        }

      },

      originalInvoice: {

        select: {

          invoiceNumber: true

        }

      }

    }

  })

}

export function buildBatchNumber(batch) {

  if (!batch)
    return '-'

  const date = new Date(batch.createdAt)

  return `B-${
    date.getFullYear()
  }${
    String(date.getMonth()+1).padStart(2,'0')
  }${
    String(date.getDate()).padStart(2,'0')
  }-${
    batch.id.slice(-6).toUpperCase()
  }`

}

export async function getExportFilters() {

  const hrPartners = await prisma.hrPartner.findMany({

    select: {
      id: true,
      name: true
    },

    orderBy: {
      name: 'asc'
    }

  })

  return {

    hrPartners,

    projects: [
      'fos',
      'atm_mitra',
      'csp_mitra',
      'seva_sarathi',
      'collections'
    ],

    natures: [
      'salary',
      'reimbursement',
      'sourcing',
      'bgv',
      'fnf'
    ],

    stages: [

      'uploaded',

      'extracted',

      'hr_maker_verified',

      'hr_checker_reviewed',

      'hr_approved',

      'compliance_verified',

      'finance_maker_verified',

      'finance_cleared',

      'paid',

      'rejected'

    ]

  }

}

// diff = invoiceValue - (taxable + cgst + sgst + igst)
// positive → Excess, negative → Short (both shown in one signed column)
function computeShortExcess(taxable, cgst, sgst, igst, invoiceValue) {

  const t = taxable != null ? Number(taxable) : 0
  const c = cgst != null ? Number(cgst) : 0
  const s = sgst != null ? Number(sgst) : 0
  const i = igst != null ? Number(igst) : 0
  const v = invoiceValue != null ? Number(invoiceValue) : 0

  if (!t || !v) return null

  return Math.round((v - (t + c + s + i)) * 100) / 100
}

export function buildExportRows(invoices, creditNotes) {

  const rows = []

  // Map: Invoice Number -> Credit Notes
  const creditMap = new Map()

  for (const cn of creditNotes) {

    const ref =
      cn.originalInvoiceNumber ??
      cn.originalInvoice?.invoiceNumber

    if (!ref)
      continue

    if (!creditMap.has(ref)) {
      creditMap.set(ref, [])
    }

    creditMap.get(ref).push(cn)

  }

  // Sort credit notes under each invoice
  for (const notes of creditMap.values()) {

    notes.sort((a, b) => {

      const dateA = a.creditNoteDate
        ? new Date(a.creditNoteDate).getTime()
        : 0

      const dateB = b.creditNoteDate
        ? new Date(b.creditNoteDate).getTime()
        : 0

      if (dateA !== dateB) {
        return dateA - dateB
      }

      return (a.creditNoteNumber ?? '')
        .localeCompare(b.creditNoteNumber ?? '')

    })

  }

  // Sort invoices by Batch -> Invoice Date -> Invoice Number
  invoices.sort((a, b) => {

    const batchA = buildBatchNumber(a.uploadBatch)
    const batchB = buildBatchNumber(b.uploadBatch)

    if (batchA !== batchB) {
      return batchA.localeCompare(batchB)
    }

    const dateA = a.invoiceDate
      ? new Date(a.invoiceDate).getTime()
      : 0

    const dateB = b.invoiceDate
      ? new Date(b.invoiceDate).getTime()
      : 0

    if (dateA !== dateB) {
      return dateA - dateB
    }

    return (a.invoiceNumber ?? '')
      .localeCompare(b.invoiceNumber ?? '')

  })

  const usedCreditNotes = new Set()

  // Add invoices followed by their credit notes
  for (const inv of invoices) {

    rows.push({

      documentType: 'Invoice',

      referenceInvoiceNumber: '-',

      batchNumber: buildBatchNumber(inv.uploadBatch),

      invoiceNumber: inv.invoiceNumber ?? '-',

      project: inv.project ?? '-',

      nature: inv.nature ?? '-',

      currentStage: inv.status?.currentStage ?? '-',

      hrPartner: inv.hrPartner?.name ?? '-',

      partnerGstin: inv.hrPartnerGstin ?? '-',

      partnerState: inv.hrPartnerState ?? '-',

      partnerAddress: inv.hrPartnerAddress ?? '-',

      sbossName: inv.sbossName ?? '-',

      sbossState: inv.sbossState ?? '-',

      sbossAddress: inv.sbossAddress ?? '-',

      irn: inv.irn ?? '-',

      invoiceDate: inv.invoiceDate ?? null,

     taxableAmount:
  inv.taxableAmount != null
    ? Number(inv.taxableAmount)
    : null,

cgst:
  inv.cgstAmount != null
    ? Number(inv.cgstAmount)
    : null,

sgst:
  inv.sgstAmount != null
    ? Number(inv.sgstAmount)
    : null,

igst:
  inv.igstAmount != null
    ? Number(inv.igstAmount)
    : null,

shortExcess:
  computeShortExcess(
    inv.taxableAmount,
    inv.cgstAmount,
    inv.sgstAmount,
    inv.igstAmount,
    inv.invoiceValue
  ) ?? '-',

invoiceValue:
  inv.invoiceValue != null
    ? Number(inv.invoiceValue)
    : null,
      paymentReferenceId:
        inv.status?.paymentReferenceId ?? '-',

      paymentDate:
        inv.status?.paymentDate ?? null

    })

    const notes = creditMap.get(inv.invoiceNumber) ?? []

    for (const cn of notes) {

      usedCreditNotes.add(cn.id)

      rows.push({

        documentType: 'Credit Note',

        referenceInvoiceNumber:
          cn.originalInvoiceNumber ??
          cn.originalInvoice?.invoiceNumber ??
          '-',

        batchNumber:
          buildBatchNumber(cn.uploadBatch),

        invoiceNumber:
          cn.creditNoteNumber ?? '-',

        project:
          cn.uploadBatch?.project ?? '-',

        nature:
          cn.uploadBatch?.nature ?? '-',

        currentStage: '-',

        hrPartner:
          cn.hrPartner?.name ?? '-',

        partnerGstin: '-',

        partnerState: '-',

        partnerAddress: '-',

        sbossName: '-',

        sbossState: '-',

        sbossAddress: '-',

        irn: '-',

        invoiceDate:
          cn.creditNoteDate ?? null,

    taxableAmount:
  cn.taxableAmount != null
    ? Number(cn.taxableAmount)
    : null,

cgst:
  cn.cgstAmount != null
    ? Number(cn.cgstAmount)
    : null,

sgst:
  cn.sgstAmount != null
    ? Number(cn.sgstAmount)
    : null,

igst:
  cn.igstAmount != null
    ? Number(cn.igstAmount)
    : null,

        shortExcess: '-',

   invoiceValue:
  cn.creditNoteValue != null
    ? Number(cn.creditNoteValue)
    : null,
        paymentReferenceId: '-',

        paymentDate: null

      })

    }

  }

  // Add orphan credit notes
  for (const cn of creditNotes) {

    if (usedCreditNotes.has(cn.id))
      continue

    rows.push({

      documentType: 'Credit Note',

      referenceInvoiceNumber:
        cn.originalInvoiceNumber ??
        cn.originalInvoice?.invoiceNumber ??
        '-',

      batchNumber:
        buildBatchNumber(cn.uploadBatch),

      invoiceNumber:
        cn.creditNoteNumber ?? '-',

      project:
        cn.uploadBatch?.project ?? '-',

      nature:
        cn.uploadBatch?.nature ?? '-',

      currentStage: '-',

      hrPartner:
        cn.hrPartner?.name ?? '-',

      partnerGstin: '-',

      partnerState: '-',

      partnerAddress: '-',

      sbossName: '-',

      sbossState: '-',

      sbossAddress: '-',

      irn: '-',

      invoiceDate:
        cn.creditNoteDate ?? null,

      taxableAmount:
        cn.taxableAmount ?? null,

      cgst:
        cn.cgstAmount ?? null,

      sgst:
        cn.sgstAmount ?? null,

      igst:
        cn.igstAmount ?? null,

      shortExcess: '-',

      invoiceValue:
        cn.creditNoteValue ?? null,

      paymentReferenceId: '-',

      paymentDate: null

    })

  }

  return rows

}

  export async function generateExcel(filters = {}) {

  const invoiceWhere =
    buildInvoiceWhere(filters)

  const creditNoteWhere =
    buildCreditNoteWhere(filters)

  const [invoices, creditNotes] = await Promise.all([

    prisma.invoice.findMany({

      where: {
  ...invoiceWhere,
  extractionStatus: "completed"
},

      orderBy: {
        createdAt: 'desc'
      },

      include: {

        hrPartner: true,

        status: true,

        uploadBatch: true

      }

    }),

    fetchCreditNotes(
      creditNoteWhere
    )

  ])

  const rows =
    buildExportRows(
      invoices,
      creditNotes
    )

  const workbook =
    new ExcelJS.Workbook()

  const sheet =
    workbook.addWorksheet('Documents')

  sheet.columns = [

    {
      header: 'Document Type',
      key: 'documentType',
      width: 18
    },

    {
      header: 'Reference Invoice Number',
      key: 'referenceInvoiceNumber',
      width: 24
    },

    {
      header: 'Batch Number',
      key: 'batchNumber',
      width: 22
    },

    {
      header: 'Invoice / Credit Note Number',
      key: 'invoiceNumber',
      width: 24
    },

    {
      header: 'Project',
      key: 'project',
      width: 16
    },

    {
      header: 'Nature',
      key: 'nature',
      width: 16
    },

    {
      header: 'Current Stage',
      key: 'currentStage',
      width: 22
    },

    {
      header: 'HR Partner',
      key: 'hrPartner',
      width: 24
    },

    {
      header: 'Partner GSTIN',
      key: 'partnerGstin',
      width: 22
    },

    {
      header: 'Partner State',
      key: 'partnerState',
      width: 18
    },

    {
      header: 'Partner Address',
      key: 'partnerAddress',
      width: 35
    },

    {
      header: 'SBOSS Name',
      key: 'sbossName',
      width: 22
    },

    {
      header: 'SBOSS State',
      key: 'sbossState',
      width: 18
    },

    {
      header: 'SBOSS Address',
      key: 'sbossAddress',
      width: 35
    },

    {
      header: 'IRN',
      key: 'irn',
      width: 30
    },

    {
      header: 'Invoice Date',
      key: 'invoiceDate',
      width: 18
    },

    {
      header: 'Taxable Amount',
      key: 'taxableAmount',
      width: 18
    },

    {
      header: 'CGST',
      key: 'cgst',
      width: 15
    },

    {
      header: 'SGST',
      key: 'sgst',
      width: 15
    },

    {
      header: 'IGST',
      key: 'igst',
      width: 15
    },

    {
      header: 'Short / Excess Amount',
      key: 'shortExcess',
      width: 20,
      style: { numFmt: '+#,##0.00;-#,##0.00;0.00' }
    },

    {
      header: 'Invoice Value',
      key: 'invoiceValue',
      width: 18
    },

    {
      header: 'Payment Reference ID',
      key: 'paymentReferenceId',
      width: 26
    },

    {
      header: 'Payment Date',
      key: 'paymentDate',
      width: 18
    }

  ]

  sheet.getRow(1).eachCell(cell => {

    cell.font = {
      bold: true,
      color: {
        argb: 'FFFFFFFF'
      }
    }

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'FF1A56A0'
      }
    }

  })

  rows.forEach(row => {

    sheet.addRow({

      ...row,

      invoiceDate:
        row.invoiceDate
          ? new Date(row.invoiceDate)
          : '-',

      paymentDate:
        row.paymentDate
          ? new Date(row.paymentDate)
          : '-'

    })

  })

  sheet.views = [
    {
      state: 'frozen',
      ySplit: 1
    }
  ]

  return workbook

}

// ZIP export 
export async function generateZip(invoiceIds, res) {

  const invoices = await prisma.invoice.findMany({
    where: {
      id: {
        in: invoiceIds
      },
      isDeleted: false
    },
    select: {
      id: true,
      invoiceNumber: true,
      pdfPath: true
    }
  })

  const archive = archiver("zip", {
    zlib: {
      level: 6
    }
  })

  archive.on("error", err => {
    throw err
  })

  archive.pipe(res)

  for (const inv of invoices) {

    try {

      const pdfBuffer =
        await downloadFile(inv.pdfPath)

      archive.append(
        pdfBuffer,
        {
          name: `${inv.invoiceNumber ?? inv.id}.pdf`
        }
      )

    }
    catch (err) {

      console.error(
        `[ZIP] Failed to add invoice ${inv.id}:`,
        err.message
      )

    }

  }

  await archive.finalize()

}
