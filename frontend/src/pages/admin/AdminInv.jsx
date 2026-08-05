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

const STAGE_LABEL = {
  uploaded: 'Parsing',
  extracted: 'HR Maker Review',
  hr_maker_verified: 'HR Checker Review',
  hr_checker_reviewed: 'HR Approver Review',
  hr_approved: 'Compliance Review',
  compliance_verified: 'Finance Maker Review',
  finance_maker_verified: 'Finance Checker Review',
  finance_cleared: 'Payment Pending',
  paid: 'Paid',
  rejected: 'Rejected',
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
  invoiceNumber: '',
  dateRange: [null, null]
}
const PAGE_SIZE = 50

const ROLE_BASE = {
  super_admin: '/admin',
  hr_team: '/hr',
  compliance_team: '/compliance',
  finance_team: '/finance',
  vendor: '/vendor',
}

const STAGE_LABELS_DOC = { hr: 'HR', compliance: 'Compliance', finance: 'Finance' }

const ROLE_STAGE = {
  hr_team: 'hr',
  compliance_team: 'compliance',
  finance_team: 'finance',
}

function InternalDocsSection({ batchId, userRole, initialDocs }) {
  const [docs, setDocs] = useState(initialDocs ?? [])
  const [activeTab, setActiveTab] = useState('hr')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ title: '', remarks: '', stage: ROLE_STAGE[userRole] ?? 'hr' })
  const [file, setFile] = useState(null)
  const canUpload = ['hr_team', 'compliance_team', 'finance_team', 'super_admin'].includes(userRole)
  const uploadStage = ROLE_STAGE[userRole]

  async function handleUpload(e) {
    e.preventDefault()
    if (!file || !form.title) return toast.error('Title and file are required')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('document', file)
      fd.append('title', form.title)
      if (form.remarks) fd.append('remarks', form.remarks)
      if (!uploadStage) fd.append('stage', form.stage)
      const r = await api.post(`/api/batches/${batchId}/internal-docs`, fd)
      setDocs(prev => [...prev, r.data.document])
      setForm({ title: '', remarks: '', stage: uploadStage ?? 'hr' })
      setFile(null)
      toast.success('Document uploaded')
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  async function handleDelete(docId) {
    try {
      await api.delete(`/api/batches/internal-docs/${docId}`)
      setDocs(prev => prev.filter(d => d.id !== docId))
      toast.success('Document deleted')
    } catch { toast.error('Delete failed') }
  }

  const tabDocs = docs.filter(d => d.stage === activeTab)
  const isUploadTab = !uploadStage || uploadStage === activeTab

  return (
    <div style={{ marginTop: 24 }}>
      <h4 style={{ marginBottom: 10 }}>Internal Supporting Documents</h4>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #e0e0e0' }}>
        {Object.entries(STAGE_LABELS_DOC).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '6px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === key ? 600 : 400,
              borderBottom: activeTab === key ? '2px solid #1a56a0' : '2px solid transparent',
              color: activeTab === key ? '#1a56a0' : '#666',
              fontSize: 13,
            }}
          >{label} ({docs.filter(d => d.stage === key).length})</button>
        ))}
      </div>

      {tabDocs.length === 0 ? (
        <p style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>No documents uploaded for this stage.</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {tabDocs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{doc.title}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{doc.originalFileName} · {doc.uploadedBy?.name} · {new Date(doc.createdAt).toLocaleDateString('en-IN')}</div>
                {doc.remarks && <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>{doc.remarks}</div>}
              </div>
              <a href={`/api/batches/internal-docs/${doc.id}/view`} target="_blank" rel="noreferrer">
                <button className="btn btn-sm">View</button>
              </a>
              {canUpload && (
                <button className="btn btn-sm" style={{ color: '#cb2431' }} onClick={() => handleDelete(doc.id)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {canUpload && isUploadTab && (
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f8f9fa', padding: 12, borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 2 }}>
            Upload to {STAGE_LABELS_DOC[uploadStage ?? form.stage]}
          </div>
          {!uploadStage && (
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} style={{ fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}>
              {Object.entries(STAGE_LABELS_DOC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          )}
          <input
            type="text" placeholder="Document title *" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{ fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
          />
          <input
            type="text" placeholder="Remarks (optional)" value={form.remarks}
            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
            style={{ fontSize: 13, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
          />
          <input type="file" onChange={e => setFile(e.target.files[0])} accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.webp" style={{ fontSize: 12 }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={uploading} style={{ alignSelf: 'flex-start' }}>
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function Batches() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isVendor = user?.role === 'vendor'
  const roleBase = ROLE_BASE[user?.role] ?? '/admin'

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
  const highlightRef = useRef(null)

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
if (f.invoiceNumber) params.invoiceNumber = f.invoiceNumber

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

  // Auto-open the batch drawer when an invoice search matches exactly one batch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (applied.invoiceNumber && batches.length === 1) {
      openDetail(batches[0].id)
    }
  }, [batches, applied.invoiceNumber])

  // Scroll the matching invoice row into view once the drawer's data has loaded
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [detail])

  function applyFilters() { setPage(1); setApplied({ ...filters }) }
  function clearFilters()  { setFilters(EMPTY_FILTERS); setPage(1); setApplied(EMPTY_FILTERS) }
  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })) }

  function searchInvoice() {
    setPage(1)
    setApplied(a => ({ ...a, invoiceNumber: filters.invoiceNumber.trim() }))
  }

  function clearInvoiceSearch() {
    setFilter('invoiceNumber', '')
    setPage(1)
    setApplied(a => ({ ...a, invoiceNumber: '' }))
  }

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

  async function downloadBatchExcel(batchId) {
  try {
    const res = await api.get(
      `/api/export/excel?batchId=${batchId}`,
      {
        responseType: "blob"
      }
    )

    const url = window.URL.createObjectURL(
      new Blob([res.data])
    )

    const a = document.createElement("a")
    a.href = url
    a.download = `${batchRef(detail)}.xlsx`
    a.click()

    window.URL.revokeObjectURL(url)

  } catch {
    toast.error("Failed to download excel")
  }
}

  const filtersApplied =
  applied.hrPartnerId ||
  applied.project ||
  applied.nature ||
  applied.status ||
  applied.invoiceNumber ||
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

      {/* Invoice Search */}
      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 1 380px' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999', fontSize: 15, pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by invoice number..."
            value={filters.invoiceNumber}
            onChange={e => setFilter('invoiceNumber', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') searchInvoice() }}
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 6, border: '1px solid #d0d5dd', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
        <button className="btn btn-primary" onClick={searchInvoice}>Search</button>
        {applied.invoiceNumber && (
          <button className="btn btn-sm" onClick={clearInvoiceSearch}>✕ Clear Search</button>
        )}
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
        <div
          onClick={() => setDetail(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 720, maxWidth: '96vw', height: '100vh', background: '#fff', padding: 24, overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0 }}>{detail._loading ? 'Loading...' : batchRef(detail)}</h3>
                {!detail._loading && <span style={{ fontSize:11, color:'#999' }}>{detail.id}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => openDetail(detail.id)}
                  disabled={detailLoading}
                >
                  ⟳ Refresh
                </button>
                <button
  className="btn btn-sm"
  onClick={() => downloadBatchExcel(detail.id)}
>
  ⬇ Excel
</button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = `/api/batches/${detail.id}/download-pdfs`
                    a.download = `batch-${detail.id.slice(-6)}.zip`
                    a.click()
                  }}
                >
                  ⬇ PDFs
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = `/api/batches/${detail.id}/download-supporting-docs`
                    a.download = `batch-${detail.id.slice(-6)}-docs.zip`
                    a.click()
                  }}
                >
                  ⬇ Docs
                </button>
                <button className="btn btn-sm" onClick={() => setDetail(null)}>✕ Close</button>
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

                {/* Vendor Documents */}
                {!isVendor && (detail.vendorDocuments?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ marginBottom: 8 }}>Vendor Documents ({detail.vendorDocuments.length})</h4>
                    {detail.vendorDocuments.map(doc => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.documentName}</div>
                          <div style={{ fontSize: 11, color: '#999' }}>{doc.originalFileName}</div>
                        </div>
                        <a href={`/api/batches/supporting-documents/${doc.id}/view`} target="_blank" rel="noreferrer">
                          <button className="btn btn-sm">View</button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* Internal Supporting Documents — visible to internal roles */}
                {!isVendor && (
                  <InternalDocsSection
                    batchId={detail.id}
                    userRole={user?.role}
                    initialDocs={detail.supportingDocuments ?? []}
                  />
                )}

                <h4 style={{ marginBottom: 10, marginTop: 24 }}>Invoices ({detail.invoices?.length ?? 0})</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#f8f9fa' }}>
                        <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e0e0e0' }}>Invoice No.</th>
                        <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e0e0e0' }}>Date</th>
                        <th style={{ padding:'8px 10px', textAlign:'right', borderBottom:'1px solid #e0e0e0' }}>Value</th>
                        <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e0e0e0' }}>workflow Stage</th>
                        <th style={{ padding:'8px 10px', textAlign:'left', borderBottom:'1px solid #e0e0e0' }}>Action</th>

                      </tr>
                    </thead>
                    <tbody>
                      {(detail.invoices ?? []).map(inv => {
                        const isMatch =
                          !!applied.invoiceNumber &&
                          !!inv.invoiceNumber &&
                          inv.invoiceNumber.toLowerCase().includes(applied.invoiceNumber.trim().toLowerCase())

                        return (
                        <tr
                          key={inv.id}
                          ref={isMatch ? highlightRef : null}
                          style={{
                            borderBottom:'1px solid #f0f0f0',
                            ...(isMatch ? { background: '#fff3cd', boxShadow: 'inset 0 0 0 2px #f5b301' } : {})
                          }}
                        >
                          <td style={{ padding:'7px 10px', fontFamily:'monospace', fontWeight:600 }}>{inv.invoiceNumber ?? '—'}</td>
                          <td style={{ padding:'7px 10px', color:'#666' }}>
                            {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:'monospace' }}>
                            {inv.invoiceValue != null ? `₹${Number(inv.invoiceValue).toLocaleString('en-IN')}` : '—'}
                          </td>
                         <td style={{ padding:'7px 10px' }}>
  <span className="badge badge-processing">
    {inv.extractionStatus === 'failed'
      ? 'Parse Failed'
      : STAGE_LABEL[inv.status?.currentStage] ?? 'Parsing'}
  </span>
</td>

<td style={{ padding:'7px 10px' }}>
  <button
    className="btn btn-sm"
    onClick={() => navigate(`${roleBase}/invoices/${inv.id}`)}
  >
    View
  </button>
</td>
                        </tr>
                        )
                      })}
                      {(detail.invoices?.length === 0) && (
                        <tr><td colSpan={5} style={{ padding:20, textAlign:'center', color:'#999' }}>No invoices in this batch</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
