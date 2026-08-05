import { Router } from 'express'
import { authenticate } from '../middleware/authMiddleware.js'
import prisma from '../config/prisma.js'
import { getFileStream } from "../services/s3Service.js";

const router = Router()

router.use(authenticate)

router.get('/credit-notes/:id/pdf', async (req, res) => {
  try {

    const creditNote = await prisma.creditNote.findFirst({
      where: {
        id: req.params.id,
        isDeleted: false
      },
      select: {
        pdfPath: true
      }
    })

    if (!creditNote) {
      return res.status(404).json({
        success: false,
        message: 'Credit note not found'
      })
    }

    const stream = await getFileStream(creditNote.pdfPath)

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", "inline")

    stream.pipe(res)

  } catch (err) {

    console.error(err)

    return res.status(404).json({
      success: false,
      message: "File not found"
    })

  }
})

router.get('/:id/pdf', async (req, res) => {

  try {

    const invoice =
      await prisma.invoice.findFirst({
        where: {
          id: req.params.id,
          isDeleted: false
        },
        select: {
          pdfPath: true
        }
      })

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      })
    }

    const stream =
  await getFileStream(invoice.pdfPath)

res.setHeader(
  "Content-Type",
  "application/pdf"
)

res.setHeader(
  "Content-Disposition",
  "inline"
)

stream.pipe(res)

  }
  catch (err) {

    console.error(err)

    return res.status(404).json({
      success: false,
      message: "File not found"
    })

  }

})

router.get('/:id', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id,
        isDeleted: false
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
            createdAt: true,
            project: true,
            nature: true
          }
        },

        status: {
          include: {
            hrMaker: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },

            hrChecker: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },

            hrApprovedBy: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },

            complianceUser: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },

            financeMaker: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },

            financeChecker: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },

            paymentUpdatedBy: {
              select: {
                id: true,
                name: true,
                username: true
              }
            }
          }
        },

        activities: {
          orderBy: {
            createdAt: 'asc'
          },

          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                role: true
              }
            }
          }
        },

      creditNotes: {
  where: {
    isDeleted: false,
    extractionStatus: 'completed'
  },

  select: {
    id: true,

    creditNoteNumber: true,
    creditNoteDate: true,
    creditNoteValue: true,

    originalInvoiceNumber: true,

    taxableAmount: true,
    cgstAmount: true,
    sgstAmount: true,
    igstAmount: true,

    extractionStatus: true,

    pdfPath: true,
    originalFileName: true,

    createdAt: true,
    updatedAt: true
  },

  orderBy: {
    createdAt: 'desc'
  }
}
      }
    })

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      })
    }

    const creditNoteTotal =
  invoice.creditNotes?.reduce(
    (sum, cn) =>
      sum + Number(cn.creditNoteValue ?? 0),
    0
  ) ?? 0

const effectiveAmount =
  invoice.invoiceValue != null
    ? Number(invoice.invoiceValue) + creditNoteTotal
    : null

    return res.json({
      success: true,
      invoice: {
        ...invoice,
        creditNoteTotal,
        effectiveAmount
      }
    })

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    })
  }
})

export default router