import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

export default function UploadInvoices() {
  const [project,   setProject]   = useState('')
  const [nature,    setNature]    = useState('')
  const [files,     setFiles]     = useState([])
  const [uploading, setUploading] = useState(false)
  const [supportingDocs, setSupportingDocs] = useState([])

  function handleFileChange(e) {
    const selected = Array.from(e.target.files)
    if (selected.length > 60) { toast.error('Maximum 60 files allowed'); return }
    setFiles(selected)
  }

  function removeFile(index) { setFiles(files.filter((_, i) => i !== index)) }

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

  async function uploadInvoices(e) {
    e.preventDefault()
    if (!project)       return toast.error('Select project')
    if (!nature)        return toast.error('Select nature')
    if (!files.length)  return toast.error('Select PDF files')

    const formData = new FormData()
    formData.append('project', project)
    formData.append('nature', nature)
    files.forEach(file =>
  formData.append('invoices', file)
)

supportingDocs.forEach(file =>
  formData.append(
    'supportingDocuments',
    file
  )
)

    setUploading(true)
    try {
      const { data } = await api.post('/api/vendor/upload', formData)
     toast.success(
  `${data.uploadedFiles} invoices uploaded successfully` +
  (
    data.supportingDocuments > 0
      ? ` with ${data.supportingDocuments} supporting document${data.supportingDocuments > 1 ? 's' : ''}`
      : ''
  )
)
      setProject(''); setNature(''); setFiles([]); setSupportingDocs([])
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Upload failed'
      toast.error(msg)
      console.error('[Upload]', err.response?.data ?? err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Upload Invoices</h2><p>
  Upload up to 60 invoices and
  10 supporting documents per batch
</p></div>
      </div>

      <div className="card">
        <form onSubmit={uploadInvoices}>
          <div className="two-col">
            <div className="form-group">
              <label>Project *</label>
              <select value={project} onChange={e => setProject(e.target.value)} required>
                <option value="">Select Project</option>
                <option value="fos">FOS</option>
                <option value="seva_sarathi">Seva Sarathi</option>
                <option value="atm_mitra">ATM Mitra</option>
                <option value="csp_mitra">CSP Mitra</option>
                <option value="collections">Collections</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nature *</label>
              <select value={nature} onChange={e => setNature(e.target.value)} required>
                <option value="">Select Nature</option>
                <option value="salary">Salary</option>
                <option value="reimbursement">Reimbursement</option>
                <option value="sourcing">Sourcing</option>
                <option value="bgv">BGV</option>
                <option value="fnf">FNF</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Invoice PDFs *</label>
            <input type="file" accept=".pdf" multiple onChange={handleFileChange} />
          </div>

           {!!files.length && (
            <div style={{ marginBottom: 16 }}>
              <strong>Selected Files ({files.length})</strong>
              <div style={{ marginTop: 10 }}>
                {files.map((file, index) => (
                  <div key={index} className="flex" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>{file.name}</span>
                    <button type="button" className="btn btn-sm" onClick={() => removeFile(index)}>Remove</button>
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
    onChange={handleSupportingDocsChange}
  />

  <small style={{
    color: '#666',
    display: 'block',
    marginTop: 6
  }}>
    Optional. Upload attendance sheets,
    salary registers, bank statements,
    employee masters etc.
    Maximum 10 files.
  </small>
</div>

          {!!supportingDocs.length && (
  <div style={{ marginBottom: 16 }}>
    <strong>
      Supporting Documents
      ({supportingDocs.length})
    </strong>

    <div style={{ marginTop: 10 }}>
      {supportingDocs.map((file, index) => (
        <div
          key={index}
          className="flex"
          style={{
            justifyContent: 'space-between',
            marginBottom: 6
          }}
        >
          <span>{file.name}</span>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              removeSupportingDoc(index)
            }
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  </div>
)}

          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? <span className="spinner" /> : `Upload ${files.length > 0 ? `${files.length} ` : ''}Invoice${files.length !== 1 ? 's' : ''}`}
          </button>
        </form>
      </div>
    </div>
  )
}
