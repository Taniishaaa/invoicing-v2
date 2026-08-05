import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

export default function UploadCreditNotes() {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [supportingDocs, setSupportingDocs] = useState([])
  const [creditNotes, setCreditNotes] = useState([])

  const STATUS_BADGE = {
  uploaded:            'badge badge-processing',
  processing:          'badge badge-pending_review',
  completed:           'badge badge-approved',
  failed:              'badge badge-rejected'
}

  function handleFileChange(e) {
    const selected = Array.from(e.target.files)

    if (selected.length > 30) {
      toast.error('Maximum 30 credit notes allowed per upload')
      return
    }

    setFiles(selected)
  }

  function removeFile(index) {
    setFiles(files.filter((_, i) => i !== index))
  }

  function handleSupportingDocsChange(e) {
    const selected = Array.from(e.target.files)

    if (selected.length > 10) {
      toast.error('Maximum 10 supporting documents allowed')
      return
    }

    setSupportingDocs(selected)
  }

  function removeSupportingDoc(index) {
    setSupportingDocs(
      supportingDocs.filter((_, i) => i !== index)
    )
  }

  async function upload(e) {
    e.preventDefault()

    if (!files.length) {
      return toast.error(
        'Please select credit note PDF files'
      )
    }

    const formData = new FormData()

    files.forEach(file => {
      formData.append(
        'invoices',
        file
      )
    })

    supportingDocs.forEach(file => {
      formData.append(
        'supportingDocuments',
        file
      )
    })

    setUploading(true)

    try {
      const { data } =
        await api.post(
          '/api/vendor/upload-credit-notes',
          formData
        )

      toast.success(
        `${data.uploadedFiles} credit note${
          data.uploadedFiles !== 1 ? 's' : ''
        } uploaded successfully${
          data.supportingDocuments > 0
            ? ` with ${data.supportingDocuments} supporting document${
                data.supportingDocuments !== 1 ? 's' : ''
              }`
            : ''
        }`
      )

      await loadCreditNotes()

      setFiles([])
      setSupportingDocs([])

    } catch (err) {

      toast.error(
        err.response?.data?.message ??
        err.message ??
        'Upload failed'
      )

    } finally {
      setUploading(false)
    }
  }

  async function loadCreditNotes() {
  try {

    const { data } =
      await api.get(
        '/api/vendor/credit-notes'
      )

    setCreditNotes(
      data.creditNotes
    )

  } catch (err) {
    console.error(err)
  }
}

useEffect(() => {
  loadCreditNotes()
}, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Upload Credit Notes</h2>

          <p>
            Upload credit note PDFs (maximum 30 files).
            The system will automatically identify
            the original invoice and attach the
            credit note to the correct batch.
          </p>
        </div>
      </div>

      <div
        className="alert"
        style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 8,
          marginBottom: 14,
          padding: '12px 16px',
          fontSize: 13
        }}
      >
        <strong>Important:</strong>

        <br /><br />

        • Credit notes reduce the payable amount
        of an existing invoice.

        <br />

        • The parser extracts the original invoice
        number mentioned inside the credit note.

        <br />

        • If the referenced invoice belongs to your
        organisation, the credit note is
        automatically linked to that invoice and
        moved into the same batch.

        <br />

        • The project, nature and workflow are
        inherited from the original invoice.

        <br />

        • If the referenced invoice cannot be found,
        the credit note will be rejected
        automatically.
      </div>

      <div className="card">
        <form onSubmit={upload}>

          <div className="form-group">
            <label>
              Credit Note PDFs *
            </label>

            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
            />
          </div>

          {!!files.length && (
            <div style={{ marginBottom: 16 }}>
              <strong>
                Selected Credit Notes ({files.length})
              </strong>

              <div style={{ marginTop: 10 }}>
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex"
                    style={{
                      justifyContent: 'space-between',
                      marginBottom: 6
                    }}
                  >
                    <span>
                      {file.name}
                    </span>

                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        removeFile(index)
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>
              Supporting Documents
            </label>

            <input
              type="file"
              multiple
              onChange={
                handleSupportingDocsChange
              }
            />

            <small
              style={{
                color: '#666',
                display: 'block',
                marginTop: 6
              }}
            >
              Optional.
              PDF, Excel, Word or Image files.
              Maximum 10 files.
            </small>
          </div>

          {!!supportingDocs.length && (
            <div style={{ marginBottom: 16 }}>
              <strong>
                Supporting Documents (
                {supportingDocs.length}
                )
              </strong>

              <div style={{ marginTop: 10 }}>
                {supportingDocs.map(
                  (file, index) => (
                    <div
                      key={index}
                      className="flex"
                      style={{
                        justifyContent:
                          'space-between',
                        marginBottom: 6
                      }}
                    >
                      <span>
                        {file.name}
                      </span>

                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          removeSupportingDoc(
                            index
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={uploading}
          >
            {uploading
              ? (
                <span className="spinner" />
              )
              : (
                `Upload ${
                  files.length > 0
                    ? `${files.length} `
                    : ''
                }Credit Note${
                  files.length !== 1
                    ? 's'
                    : ''
                }`
              )}
          </button>

        </form>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
  <h3>
    Uploaded Credit Notes
  </h3>

  {
    creditNotes.length === 0
      ? (
        <p>
          No credit notes uploaded yet.
        </p>
      )
      : (
        <table className="table">
          <thead>
            <tr>
              <th>Credit Note</th>
              <th>Reference Invoice</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Batch</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {
              creditNotes.map(cn => (
                <tr key={cn.id}>
                 <td>
  {
    cn.extractionStatus === 'failed'
      ? '-'
      : cn.creditNoteNumber ?? 'Parsing...'
  }
</td>

                  <td>
  {
    cn.extractionStatus === 'failed'
      ? '-'
      : cn.originalInvoiceNumber ?? '-'
  }
</td>

                  <td>
  {
    cn.extractionStatus === 'failed'
      ? '-'
      : cn.creditNoteValue != null
      ? `₹${Number(
          cn.creditNoteValue
        ).toLocaleString()}`
      : '-'
  }
</td>

                  <td>
  {
    cn.extractionStatus === 'failed'
      ? '-'
      : cn.creditNoteDate
      ? new Date(
          cn.creditNoteDate
        ).toLocaleDateString()
      : '-'
  }
</td>

                  <td>
                    {
                      cn.uploadBatch
                        ? `${cn.uploadBatch.project} / ${cn.uploadBatch.nature}`
                        : '-'
                    }
                  </td>

               <td>
  <span
    className={
      STATUS_BADGE[
        cn.extractionStatus
      ]
    }
  >
    {
      cn.extractionStatus === 'completed'
        ? 'Parsed'
        : cn.extractionStatus === 'failed'
        ? 'Failed'
        : cn.extractionStatus === 'processing'
        ? 'Processing'
        : 'Uploaded'
    }
  </span>
</td>

<td>
 <td>
  <button
    className="btn btn-sm"
    onClick={() =>
      window.open(
        `/api/invoices/credit-notes/${cn.id}/pdf`,
        '_blank'
      )
    }
  >
    View
  </button>
</td>
</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      )
  }
</div>
    </div>
  )
}