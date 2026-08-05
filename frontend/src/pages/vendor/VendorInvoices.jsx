import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import useAuth from '../../hooks/useAuth'
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const PROJECT_LABELS = {
  fos: 'FOS', atm_mitra: 'ATM Mitra', csp_mitra: 'CSP Mitra',
  seva_sarathi: 'Seva Sarathi', collections: 'Collections'
}
const NATURE_LABELS = {
  salary: 'Salary', reimbursement: 'Reimbursement', fnf: 'FNF', bgv: 'BGV', sourcing: 'Sourcing'
}

const STATUS_BADGE = {
  uploaded:            'badge badge-processing',
  processing:          'badge badge-pending_review',
  completed:           'badge badge-approved',
  partially_completed: 'badge badge-pending_review',
  failed:              'badge badge-rejected'
}

function batchRef(batch) {
  const d = new Date(batch.createdAt)
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  return `B-${date}-${batch.id.slice(-6).toUpperCase()}`
}

const EMPTY_FILTERS = {
  hrPartnerId: '',
  project: '',
  nature: '',
  status: '',
  dateRange: [null, null]
}
const PAGE_SIZE = 50

const INVOICE_STATUS_BADGE = {
  pending: 'badge badge-processing',
  processing: 'badge badge-processing',
  completed: 'badge badge-approved',
  failed: 'badge badge-rejected'
}

export default function VendorInv() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isVendor = user?.role === 'vendor'

  const [batches,      setBatches]      = useState([])
  const [partners,     setPartners]     = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [loading,      setLoading]      = useState(false)
  const [filters,      setFilters]      = useState(EMPTY_FILTERS)
  const [applied,      setApplied]      = useState(EMPTY_FILTERS)
  const [detail,       setDetail]       = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [startDate, endDate] = filters.dateRange;
   const [reuploadId,   setReuploadId]   = useState(null)
    const [reuploadFile, setReuploadFile] = useState(null)
    const [reuploading,  setReuploading]  = useState(false)
    const fileRef = useRef()
    const [supportDocsOpen, setSupportDocsOpen] = useState(false)
const [supportDocs, setSupportDocs] = useState([])
const [supportDocsLoading, setSupportDocsLoading] = useState(false)
const [previewDoc, setPreviewDoc] = useState(null)

  useEffect(() => {
    if (!isVendor) {
      api.get('/api/hr-partners').then(r => setPartners(r.data.partners ?? []))
    }
  }, [isVendor])

  const load = useCallback(async (pg, f) => {
    setLoading(true)
    try {
      const params = {
  page: pg,
  pageSize: PAGE_SIZE,
}

if (f.hrPartnerId) params.hrPartnerId = f.hrPartnerId
if (f.project) params.project = f.project
if (f.nature) params.nature = f.nature
if (f.status) params.status = f.status

const [start, end] = f.dateRange || []

if (start)
  params.dateFrom = start.toISOString().split("T")[0]

if (end)
  params.dateTo = end.toISOString().split("T")[0]

      const r = await api.get('/api/batches', { params })
      setBatches(r.data.batches ?? [])
      setTotal(r.data.total ?? 0)
    } catch {
      toast.error('Failed to load batches')
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(page, applied) }, [page, applied, load])

    async function handleDelete(id) {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return
    try {
      await api.delete(`/api/vendor/invoices/${id}`)

toast.success('Invoice deleted')

await load(page, applied)

if (detail?.id) {
  await openDetail(detail.id)
}
    } catch (err) { toast.error(err.response?.data?.message ?? 'Delete failed') }
  }

   async function handleReupload() {
    if (!reuploadFile) return toast.error('Select a PDF file')
    setReuploading(true)
    try {
      const form = new FormData()
      form.append('file', reuploadFile)
      await api.post(`/api/vendor/invoices/${reuploadId}/reupload`, form)
      toast.success('Invoice re-uploaded and queued for processing')
      setReuploadId(null); setReuploadFile(null)
      load(page, applied)
    } catch (err) { toast.error(err.response?.data?.message ?? 'Re-upload failed') }
    finally { setReuploading(false) }
  }


  function applyFilters() { setPage(1); setApplied({ ...filters }) }
  function clearFilters()  { setFilters(EMPTY_FILTERS); setPage(1); setApplied(EMPTY_FILTERS) }
  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })) }

  async function openDetail(batchId) {
    setDetailLoading(true)
    setDetail({ _loading: true })
    try {
      const r = await api.get(`/api/batches/${batchId}`)
      setDetail(r.data.batch)
    } catch {
      toast.error('Failed to load batch detail')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function downloadPdfs(batchId) {
  try {
    const response = await api.get(
      `/api/batches/${batchId}/download-pdfs`,
      {
        responseType: 'blob'
      }
    )

    const url =
      window.URL.createObjectURL(
        new Blob([response.data])
      )

    const link =
      document.createElement('a')

    link.href = url

    link.setAttribute(
      'download',
      `${batchRef(detail)}-pdfs.zip`
    )

    document.body.appendChild(link)

    link.click()

    link.remove()

    window.URL.revokeObjectURL(url)
  }
  catch {
    toast.error(
      'Failed to download PDFs'
    )
  }
}

async function openSupportingDocs(
  batchId
) {
  setSupportDocsLoading(true)
  setSupportDocsOpen(true)

  try {
    const res =
      await api.get(
        `/api/batches/${batchId}/supporting-documents`
      )

    setSupportDocs(
      res.data.documents ?? []
    )
  }
  catch {
    toast.error(
      'Failed to load supporting documents'
    )

    setSupportDocs([])
  }
  finally {
    setSupportDocsLoading(false)
  }
}

async function downloadSupportingDocs(batchId) {
  try {
    const response = await api.get(
      `/api/batches/${batchId}/download-supporting-docs`,
      {
        responseType: 'blob'
      }
    )

    const url = window.URL.createObjectURL(
      new Blob([response.data])
    )

    const link =
      document.createElement('a')

    link.href = url

    link.setAttribute(
      'download',
      `${batchRef(detail)}-supporting-documents.zip`
    )

    document.body.appendChild(link)

    link.click()

    link.remove()

    window.URL.revokeObjectURL(url)
  }
  catch (err) {
  if (err.response?.status === 404) {
    toast.error('No supporting documents found')
  } else {
    toast.error(
      'Failed to download supporting documents'
    )
  }
}
}

  const filtersApplied =
  applied.hrPartnerId ||
  applied.project ||
  applied.nature ||
  applied.status ||
  applied.dateRange?.[0] ||
  applied.dateRange?.[1]

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Batches</h2>
          <p>{total} batch{total !== 1 ? 'es' : ''} found</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div
  style={{
    display: "grid",
   gridTemplateColumns:
  isVendor
    ? "repeat(5, minmax(160px, 1fr)) auto"
    : "repeat(6, minmax(160px, 1fr)) auto",
    gap: 10,
    alignItems: "end",
  }}
>
          {!isVendor && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>HR Partner</label>
              <select value={filters.hrPartnerId} onChange={e => setFilter('hrPartnerId', e.target.value)}>
                <option value="">All</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Project</label>
            <select value={filters.project} onChange={e => setFilter('project', e.target.value)}>
              <option value="">All</option>
              {Object.entries(PROJECT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Nature</label>
            <select value={filters.nature} onChange={e => setFilter('nature', e.target.value)}>
              <option value="">All</option>
              {Object.entries(NATURE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Status</label>
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All</option>
              <option value="uploaded">Uploaded</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="partially_completed">Partial</option>
              <option value="failed">Failed</option>
            </select>
          </div>
         <div className="form-group" style={{ marginBottom: 0 }}>
  <label>Date Range</label>

  <DatePicker
    selectsRange
    startDate={startDate}
    endDate={endDate}
    onChange={(update) =>
      setFilter("dateRange", update)
    }
    isClearable
    placeholderText="Select date range"
    dateFormat="dd/MM/yyyy"
  />
</div>
<div
  style={{
    display: "flex",
    alignItems: "flex-end",
  }}
>
  {!filtersApplied ? (
    <button
      className="btn btn-primary"
      onClick={applyFilters}
    >
      Apply
    </button>
  ) : (
    <button
      className="btn"
      onClick={clearFilters}
    >
      Clear
    </button>
  )}
</div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch Ref</th>
                {!isVendor && <th>HR Partner</th>}
                <th>Project</th>
                <th>Nature</th>
                <th style={{ textAlign:'center' }}>Total</th>
                <th style={{ textAlign:'center' }}>Processed</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={isVendor ? 10 : 11} style={{ textAlign: 'center', padding: 32, color: '#999' }}>Loading...</td></tr>
              )}
              {!loading && batches.length === 0 && (
                <tr><td colSpan={isVendor ? 10 : 11} style={{ textAlign: 'center', padding: 32, color: '#999' }}>No batches found</td></tr>
              )}
              {!loading && batches.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1a56a0' }}>
                    {batchRef(b)}
                  </td>
                  {!isVendor && <td style={{ fontWeight: 500 }}>{b.hrPartner?.name ?? '—'}</td>}
                  <td>{PROJECT_LABELS[b.project] ?? b.project}</td>
                  <td>{NATURE_LABELS[b.nature] ?? b.nature}</td>
                  <td style={{ textAlign: 'center' }}>{b.totalFiles}</td>
                  <td style={{ textAlign: 'center', color: '#22863a' }}>{b.processedFiles}</td>
                  <td><span className={STATUS_BADGE[b.status] ?? 'badge'}>{b.status?.replace(/_/g, ' ')}</span></td>
                  <td style={{ color: '#999', fontSize: 12 }}>
                    {new Date(b.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openDetail(b.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: 12, color: '#999' }}>Page {page} of {totalPages} · {total} total</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
              <button className="btn btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Batch Detail Drawer */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ width: 720, maxWidth: '96vw', height: '100vh', background: '#fff', padding: 24, overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0 }}>{detail._loading ? 'Loading...' : batchRef(detail)}</h3>
                {!detail._loading && <span style={{ fontSize:11, color:'#999' }}>{detail.id}</span>}
              </div>
              <div
  style={{
    display:'flex',
    gap:8,
    alignItems:'center'
  }}
>

  <button
    className="btn btn-sm"
    onClick={() =>
      downloadPdfs(detail.id)
    }
  >
    PDFs
  </button>

  <button
    className="btn btn-sm"
    onClick={() =>
      openSupportingDocs(detail.id)
    }
  >
    Supp Docs
  </button>

  <button
    className="btn btn-sm"
    onClick={() =>
      setDetail(null)
    }
  >
    ✕ Close
  </button>

</div>
            </div>

            {detailLoading ? (
              <p style={{ color: '#999' }}>Loading batch details...</p>
            ) : (
              <>
                <div className="card" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><span style={{ fontSize:11, color:'#999', display:'block' }}>HR Partner</span><strong>{detail.hrPartner?.name ?? '—'}</strong></div>
                  <div><span style={{ fontSize:11, color:'#999', display:'block' }}>Project</span>{PROJECT_LABELS[detail.project] ?? detail.project}</div>
                  <div><span style={{ fontSize:11, color:'#999', display:'block' }}>Nature</span>{NATURE_LABELS[detail.nature] ?? detail.nature}</div>
                  <div><span style={{ fontSize:11, color:'#999', display:'block' }}>Status</span><span className={STATUS_BADGE[detail.status] ?? 'badge'}>{detail.status?.replace(/_/g,' ')}</span></div>
                  <div><span style={{ fontSize:11, color:'#999', display:'block' }}>Upload Date</span>{new Date(detail.createdAt).toLocaleString('en-IN')}</div>
                  <div><span style={{ fontSize:11, color:'#999', display:'block' }}>Total Files</span>{detail.totalFiles}</div>
                  <div>
                    <span style={{ fontSize:11, color:'#999', display:'block' }}>Processed / Failed</span>
                    <span style={{ color:'#22863a' }}>{detail.processedFiles}</span>
                    <span style={{ color:'#999' }}> / </span>
                    <span style={{ color: detail.failedFiles > 0 ? '#cb2431' : '#999' }}>{detail.failedFiles}</span>
                  </div>
                </div>

                <h4 style={{ marginBottom: 10 }}>Invoices ({detail.invoices?.length ?? 0})</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#f8f9fa' }}>
                        <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e0e0e0' }}>Invoice No.</th>
                        <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e0e0e0' }}>Date</th>
                        <th style={{ padding:'8px 10px', textAlign:'right', borderBottom:'1px solid #e0e0e0' }}>Value</th>
                        <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e0e0e0' }}>Status</th>
                        <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e0e0e0' }}>Action</th>

                      </tr>
                    </thead>
                  <tbody>
  {(detail.invoices ?? []).map(inv => (
    <>
      {/* Original Invoice */}
      <tr
        key={inv.id}
        style={{
          borderBottom:'1px solid #f0f0f0'
        }}
      >
        <td
          style={{
            padding:'7px 10px',
            fontFamily:'monospace',
            fontWeight:600
          }}
        >
          {inv.invoiceNumber ?? '—'}
        </td>

        <td
          style={{
            padding:'7px 10px',
            color:'#666'
          }}
        >
          {
            inv.invoiceDate
              ? new Date(
                  inv.invoiceDate
                ).toLocaleDateString('en-IN')
              : '—'
          }
        </td>

        <td
          style={{
            padding:'7px 10px',
            textAlign:'right',
            fontFamily:'monospace'
          }}
        >
          {
            inv.invoiceValue != null
              ? `₹${Number(
                  inv.invoiceValue
                ).toLocaleString('en-IN')}`
              : '—'
          }
        </td>

        <td>
          <span
            className={
              INVOICE_STATUS_BADGE[
                inv.extractionStatus
              ]
            }
          >
            {
              inv.extractionStatus === 'completed'
                ? 'Processed'
                : inv.extractionStatus === 'failed'
                ? 'Failed'
                : 'Processing'
            }
          </span>
        </td>

        <td>
          <div
            style={{
              display:'flex',
              gap:6,
              flexWrap:'wrap'
            }}
          >
            <button
              className="btn btn-sm"
              onClick={() =>
                navigate(
                  `/vendor/invoices/${inv.id}`
                )
              }
            >
              View
            </button>

            {
              inv.extractionStatus ===
              'failed' && (
                <>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      handleDelete(inv.id)
                    }
                  >
                    Delete
                  </button>

                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setReuploadId(inv.id)
                      setReuploadFile(null)
                    }}
                  >
                    Re-upload
                  </button>
                </>
              )
            }
          </div>
        </td>
      </tr>

      {/* Linked Credit Notes */}
      {
        inv.creditNotes?.map(cn => (
          <tr
            key={cn.id}
            style={{
              background:'#fff8f0'
            }}
          >
            <td
              style={{
                padding:'7px 10px 7px 40px',
                fontFamily:'monospace',
                color:'#b26a00'
              }}
            >
              ↳ {cn.creditNoteNumber}
            </td>

            <td
              style={{
                padding:'7px 10px',
                color:'#666'
              }}
            >
              {
                cn.creditNoteDate
                  ? new Date(
                      cn.creditNoteDate
                    ).toLocaleDateString('en-IN')
                  : '—'
              }
            </td>

            <td
              style={{
                padding:'7px 10px',
                textAlign:'right',
                fontFamily:'monospace',
                color:'#cb2431'
              }}
            >
              ₹{
                Number(
                  cn.creditNoteValue
                ).toLocaleString('en-IN')
              }
            </td>

            <td>
              <span
                className="badge badge-rejected"
              >
                CN
              </span>
            </td>

            <td>
              —
            </td>
          </tr>
        ))
      }
    </>
  ))}

  {(detail.invoices?.length === 0) && (
    <tr>
      <td
        colSpan={5}
        style={{
          padding:20,
          textAlign:'center',
          color:'#999'
        }}
      >
        No invoices in this batch
      </td>
    </tr>
  )}
</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {supportDocsOpen && (
  <div
    style={{
      position:'fixed',
      inset:0,
      background:'rgba(0,0,0,0.55)',
      display:'flex',
      justifyContent:'center',
      alignItems:'center',
      zIndex:1200
    }}
  >
    <div
      className="card"
      style={{
        width:700,
        maxWidth:'90vw',
        maxHeight:'80vh',
        overflowY:'auto',
        margin:0
      }}
    >
     <div
  style={{
    display:'flex',
    justifyContent:'space-between',
    marginBottom:20
  }}
>
  <h3>
    Supporting Documents
  </h3>

  <div
    style={{
      display:'flex',
      gap:8
    }}
  >
    <button
  className="btn btn-sm"
  onClick={() =>
    downloadSupportingDocs(detail.id)
  }
>
  PDFs
</button>

   <button
  className="btn btn-sm"
  onClick={() => {
    setSupportDocsOpen(false)
    setSupportDocs([])
  }}
>
  Close
</button>
  </div>
</div>

      {supportDocsLoading && (
        <p>
          Loading supporting documents...
        </p>
      )}

      {!supportDocsLoading &&
        supportDocs.length === 0 && (
          <p
            style={{
              color:'#999'
            }}
          >
            No supporting documents
            uploaded for this batch.
          </p>
      )}

      {!supportDocsLoading &&
        supportDocs.map(doc => (
          <div
            key={doc.id}
            style={{
              display:'flex',
              justifyContent:'space-between',
              alignItems:'center',
              padding:'10px 0',
              borderBottom:
                '1px solid #eee'
            }}
          >
            <div>
            <div style={{ fontWeight:600 }}>
  {doc.originalFileName}
</div>

{
  doc.creditNote && (
    <div
      style={{
        fontSize:12,
        color:'#dc3545',
        marginTop:4
      }}
    >
      Credit Note:
      {' '}
      {doc.creditNote.creditNoteNumber}
    </div>
  )
}

              <div
                style={{
                  fontSize:12,
                  color:'#999'
                }}
              >
                {doc.mimeType}
              </div>
            </div>

           <button
  className="btn btn-sm"
  onClick={() => setPreviewDoc(doc)}
>
  View
</button>
          </div>
      ))}
    </div>
  </div>
)}

{previewDoc && (
  <div
    style={{
      position:'fixed',
      inset:0,
      background:'rgba(0,0,0,.7)',
      display:'flex',
      justifyContent:'center',
      alignItems:'center',
      zIndex:1300
    }}
  >
    <div
      style={{
        width:'90vw',
        height:'90vh',
        background:'#fff',
        borderRadius:8,
        overflow:'hidden'
      }}
    >
      <div
        style={{
          display:'flex',
          justifyContent:'space-between',
          padding:12,
          borderBottom:'1px solid #eee'
        }}
      >
        <strong>
          {previewDoc.originalFileName}
        </strong>

        <button
          className="btn btn-sm"
          onClick={() =>
            setPreviewDoc(null)
          }
        >
          Close
        </button>
      </div>

      <iframe
        src={`/api/batches/supporting-documents/${previewDoc.id}/view`}
        title="preview"
        style={{
          width:'100%',
          height:'calc(100% - 55px)',
          border:'none'
        }}
      />
    </div>
  </div>
)}

        {/* Reupload Modal */}
      {reuploadId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100 }}>
          <div className="card" style={{ width:400, margin:0 }}>
            <h3 style={{ marginTop:0, marginBottom:14 }}>Re-upload Invoice PDF</h3>
            <p style={{ fontSize:13, color:'#666', marginBottom:14 }}>
              The existing PDF will be replaced and the invoice will go back through the parser from the beginning.
            </p>
            <div className="form-group">
              <label>Select PDF *</label>
              <input type="file" accept="application/pdf" ref={fileRef}
                onChange={e => setReuploadFile(e.target.files[0])} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" onClick={handleReupload} disabled={reuploading || !reuploadFile}>
                {reuploading ? 'Uploading...' : 'Re-upload & Process'}
              </button>
              <button className="btn" onClick={() => { setReuploadId(null); setReuploadFile(null) }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>

    
  )
}
