import multer from 'multer'

const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: {
    files: 60,
    fileSize: 15 * 1024 * 1024
  },

 fileFilter: (req, file, cb) => {

  // Invoice PDFs
  if (file.fieldname === 'invoices') {
    if (file.mimetype !== 'application/pdf') {
      return cb(
        new Error(
          'Invoice files must be PDFs only'
        )
      )
    }

    return cb(null, true)
  }

  // Supporting documents
  if (
    file.fieldname ===
    'supportingDocuments'
  ) {
    const allowedTypes = [
      // PDF
      'application/pdf',

      // Excel
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      // Word
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

      // Images
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp'
    ]

    if (
      !allowedTypes.includes(
        file.mimetype
      )
    ) {
      return cb(
        new Error(
          'Supporting documents can only be PDF, Excel, Word or Image files'
        )
      )
    }

    return cb(null, true)
  }

  if (file.fieldname === 'file') {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Invoice files must be PDFs only'))
    }
    return cb(null, true)
  }

  if (file.fieldname === 'document') {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/jpg', 'image/webp'
    ]
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Supporting documents can only be PDF, Excel, Word or Image files'))
    }
    return cb(null, true)
  }

  return cb(new Error('Unknown upload field'))
}
})

export default upload
