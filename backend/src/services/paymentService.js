import ExcelJS from 'exceljs'
import prisma  from '../config/prisma.js'
import { buildInvoiceWhere } from './exportService.js'

// Generate downloadable Excel template pre-filled with cleared+unpaid invoices
// Generate downloadable Excel template pre-filled with cleared + unpaid invoices
export async function generatePaymentTemplate(filters = {}) {

  const where = buildInvoiceWhere(filters)

  where.status = {
    ...where.status,
    financeStatus: 'cleared',
    paymentStatus: 'unpaid'
  }

  const invoices = await prisma.invoice.findMany({

    where,

    orderBy: {
      createdAt: 'asc'
    },

    include: {

      hrPartner: {
        select: {
          name: true
        }
      },

      uploadBatch: {
        select: {
          id: true,
          createdAt: true
        }
      }

    }

  })

  const workbook = new ExcelJS.Workbook()

  const sheet = workbook.addWorksheet('Payment Sheet')

  sheet.columns = [

    {
      header: 'Batch Number',
      key: 'batchNumber',
      width: 24
    },

    {
      header: 'Invoice Number',
      key: 'invoiceNumber',
      width: 22
    },

    {
      header: 'HR Partner',
      key: 'hrPartner',
      width: 30
    },

    {
      header: 'Invoice Value',
      key: 'invoiceValue',
      width: 16
    },

    {
      header: 'UTR Number',
      key: 'utrNumber',
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

  for (const inv of invoices) {

    const batchNumber = inv.uploadBatch

      ? `B-${inv.uploadBatch.createdAt.getFullYear()}${String(inv.uploadBatch.createdAt.getMonth() + 1).padStart(2, '0')}${String(inv.uploadBatch.createdAt.getDate()).padStart(2, '0')}-${inv.uploadBatch.id.slice(-6).toUpperCase()}`

      : ''

    sheet.addRow({

      batchNumber,

      invoiceNumber: inv.invoiceNumber,

      hrPartner: inv.hrPartner?.name ?? '',

      invoiceValue: inv.invoiceValue
        ? Number(inv.invoiceValue)
        : '',

      utrNumber: '',

      paymentDate: ''

    })

  }

  sheet.views = [
    {
      state: 'frozen',
      ySplit: 1
    }
  ]

  return workbook.xlsx.writeBuffer()

}

// Parse uploaded payment Excel — returns preview with matches and errors
export async function previewPaymentImport(fileBuffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(fileBuffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('No worksheet found in the uploaded file')

  const rows = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
   const batchNumber   = String(row.getCell(1).value ?? '').trim()
const invoiceNumber = String(row.getCell(2).value ?? '').trim()
const invoiceValue  = row.getCell(4).value
const utrRaw        = row.getCell(5).value
const dateRaw       = row.getCell(6).value
    if (!invoiceNumber) return
    rows.push({
      rowNumber,
      invoiceNumber,
      invoiceValue: invoiceValue != null ? Number(invoiceValue) : null,
      utrNumber:    utrRaw  != null ? String(utrRaw).trim()  : '',
      paymentDate:  dateRaw != null ? _toDate(dateRaw)        : null,
    })
  })

  if (rows.length === 0) throw new Error('No data rows found in the uploaded file')

  const matched = []
  const errors  = []

  for (const r of rows) {
    if (!r.utrNumber) {
      errors.push({ row: r.rowNumber, invoiceNumber: r.invoiceNumber, reason: 'UTR number is empty' })
      continue
    }
    if (!r.paymentDate) {
      errors.push({ row: r.rowNumber, invoiceNumber: r.invoiceNumber, reason: 'Payment date is empty or invalid' })
      continue
    }

    const invoice = await prisma.invoice.findFirst({
      where:   { invoiceNumber: r.invoiceNumber, isDeleted: false },
      include: { status: true, hrPartner: { select: { name: true } } },
    })

    if (!invoice) {
      errors.push({ row: r.rowNumber, invoiceNumber: r.invoiceNumber, reason: 'Invoice number not found' })
      continue
    }
    if (invoice.status?.financeStatus !== 'cleared') {
      errors.push({ row: r.rowNumber, invoiceNumber: r.invoiceNumber, reason: 'Invoice is not finance-cleared' })
      continue
    }
    if (invoice.status?.paymentStatus === 'paid') {
      errors.push({ row: r.rowNumber, invoiceNumber: r.invoiceNumber, reason: 'Invoice already marked paid' })
      continue
    }
    const dbValue = invoice.invoiceValue ? Number(invoice.invoiceValue) : null
    if (r.invoiceValue != null && dbValue != null && Math.abs(dbValue - r.invoiceValue) > 1) {
      errors.push({ row: r.rowNumber, invoiceNumber: r.invoiceNumber, reason: `Amount mismatch: sheet ₹${r.invoiceValue} vs system ₹${dbValue}` })
      continue
    }

    matched.push({
      invoiceId:     invoice.id,
      invoiceNumber: r.invoiceNumber,
      hrPartner:     invoice.hrPartner?.name,
      invoiceValue:  dbValue,
      utrNumber:     r.utrNumber,
      paymentDate:   r.paymentDate,
    })
  }

  return { matched, errors, totalRows: rows.length }
}

// Apply confirmed payments from preview
export async function confirmPaymentImport(rows, userId) {
  const results = { success: [], failed: [] }

  for (const r of rows) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where:   { id: r.invoiceId },
        include: { status: true },
      })
      if (!invoice)                                    throw new Error('Invoice not found')
      if (invoice.status?.financeStatus !== 'cleared') throw new Error('Not cleared')
      if (invoice.status?.paymentStatus === 'paid')    throw new Error('Already paid')

      await prisma.$transaction([
        prisma.invoiceStatus.update({
          where: { invoiceId: r.invoiceId },
          data:  {
            paymentStatus:      'paid',
            currentStage:       'paid',
            paymentReferenceId: r.utrNumber,
            paymentDate:        new Date(r.paymentDate),
            paymentUpdatedById: userId,
          }
        }),
        prisma.invoiceActivity.create({
          data: {
            invoiceId: r.invoiceId,
            userId,
            action:  'PAYMENT_MARKED',
            remarks: `UTR: ${r.utrNumber} | Date: ${r.paymentDate} (via Excel import)`,
            role:    'finance_team',
          }
        }),
      ])

      results.success.push(r.invoiceNumber)
    } catch (err) {
      results.failed.push({ invoiceNumber: r.invoiceNumber, reason: err.message })
    }
  }

  return results
}

function _toDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = String(value).trim()
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
