import { generateExcel, getExportFilters } from '../services/exportService.js'

export async function exportExcel(req, res) {

  try {
    const workbook = await generateExcel({
  ...req.query,
  batchId: req.query.batchId
})

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Invoice_Export_${timestamp}.xlsx`
    )
    await workbook.xlsx.write(res)
    res.end()
  }

  catch (err) {
    console.error(err)
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}

export async function filters(req, res, next) {

  try {

    const data = await getExportFilters()

    res.json({

      success: true,

      ...data

    })

  }

  catch (err) {

    next(err)

  }

}