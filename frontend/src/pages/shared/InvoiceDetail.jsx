import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import useAuth from '../../hooks/useAuth'

const PROJECT_LABELS = { fos:'FOS', atm_mitra:'ATM Mitra', csp_mitra:'CSP Mitra', seva_sarathi:'Seva Sarathi', collections:'Collections' }
const NATURE_LABELS  = { salary:'Salary', reimbursement:'Reimbursement', fnf:'FNF', bgv:'BGV', sourcing:'Sourcing' }

const STAGE_LABEL = {
  uploaded:               'Parsing',
  extracted:              'HR Maker Review',
  hr_maker_verified:      'HR Checker Review',
  hr_checker_reviewed:    'HR Approver Review',
  hr_approved:            'Compliance Review',
  compliance_verified:    'Finance Maker Review',
  finance_maker_verified: 'Finance Checker Review',
  finance_cleared:        'Payment Pending',
  paid:                   'Paid',
  rejected:               'Rejected',
}

const STAGE_COLOR = {
  uploaded:               '#856404',
  extracted:              '#004085',
  hr_maker_verified:      '#004085',
  hr_checker_reviewed:    '#004085',
  hr_approved:            '#155724',
  compliance_verified:    '#6f42c1',
  finance_maker_verified: '#6f42c1',
  finance_cleared:        '#fd7e14',
  paid:                   '#28a745',
  rejected:               '#dc3545',
}

function money(v) {
  if (v == null) return '—'
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function Field({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
        {value ?? '—'}
      </div>
    </div>
  )
}

function StageTimeline({ st }) {
  const stages = [
    { key: 'extracted',              label: 'HR Maker',       user: st?.hrMaker,        at: st?.hrMakerAt,        remarks: st?.hrMakerRemarks },
    { key: 'hr_maker_verified',      label: 'HR Checker',     user: st?.hrChecker,      at: st?.hrCheckerAt,      remarks: st?.hrCheckerRemarks },
    { key: 'hr_checker_reviewed',    label: 'HR Approver',    user: st?.hrApprovedBy,   at: st?.hrApprovedAt,     remarks: st?.hrRemarks },
    { key: 'compliance_verified',    label: 'Compliance',     user: st?.complianceUser, at: st?.complianceAt,     remarks: st?.complianceRemarks },
    { key: 'finance_maker_verified', label: 'Finance Maker',  user: st?.financeMaker,   at: st?.financeMakerAt,   remarks: st?.financeMakerRemarks },
    { key: 'finance_cleared',        label: 'Finance Checker',user: st?.financeChecker, at: st?.financeCheckerAt, remarks: st?.financeCheckerRemarks },
  ]
  const stageOrder = ['uploaded','extracted','hr_maker_verified','hr_checker_reviewed','hr_approved','compliance_verified','finance_maker_verified','finance_cleared','paid','rejected']
  const currentIdx = stageOrder.indexOf(st?.currentStage ?? 'uploaded')

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3 style={{ marginTop: 0, fontSize: 14 }}>Workflow Progress</h3>
      {stages.map((s, i) => {
        const done = stageOrder.indexOf(s.key) <= currentIdx
        return (
          <div key={s.key} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: done ? '#28a745' : '#e0e0e0', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>
              {done ? '✓' : i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: done ? '#155724' : '#999' }}>{s.label}</div>
              {s.user && <div style={{ fontSize: 11, color: '#555' }}>{s.user.name} &middot; {s.at ? new Date(s.at).toLocaleString('en-IN') : ''}</div>}
              {s.remarks && <div style={{ fontSize: 11, fontStyle: 'italic', color: '#666' }}>&#34;{s.remarks}&#34;</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function InvoiceDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const location    = useLocation()
  const { user }    = useAuth()
  const rolePrefix  = '/' + location.pathname.split('/')[1]

  const [invoice,    setInvoice]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null)
  const [remarks,    setRemarks]    = useState('')
  const [utr,        setUtr]        = useState('')
  const [payDate,    setPayDate]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults,setLinkResults]= useState([])
  const [linking,    setLinking]    = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await api.get(`/api/invoices/${id}`)
      setInvoice(r.data.invoice)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to load invoice')
    } finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [id])

  async function searchInvoices(q) {
    if (!q.trim()) { setLinkResults([]); return }
    try {
      const r = await api.get('/api/admin/invoices', { params: { invoiceNumber: q, pageSize: 10 } })
      setLinkResults((r.data.invoices ?? []).filter(i => i.type !== 'credit_note'))
    } catch { setLinkResults([]) }
  }

  async function linkCreditNote(originalInvoiceId) {
    setLinking(true)
    try {
      await api.patch(`/api/admin/invoices/${id}/link-credit-note`, { originalInvoiceId })
      toast.success('Credit note linked')
      setLinkSearch(''); setLinkResults([])
      load()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Link failed')
    } finally { setLinking(false) }
  }

  async function unlinkCreditNote() {
    setLinking(true)
    try {
      await api.patch(`/api/admin/invoices/${id}/link-credit-note`, { originalInvoiceId: null })
      toast.success('Credit note unlinked')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Unlink failed')
    } finally { setLinking(false) }
  }

  async function doAction() {
    if ((modal === 'reject' || modal === 'hr_reject' || modal === 'comp_reject' || modal === 'fin_reject') && !remarks.trim())
      return toast.error('Remarks are required for rejection')
    if (modal === 'payment') {
      if (!utr.trim())  return toast.error('UTR number required')
      if (!payDate)     return toast.error('Payment date required')
    }
    setSaving(true)
    try {
      const st = invoice?.status
      if (modal === 'hr_verify')   await api.patch(`/api/hr/invoices/${id}/verify`,   { remarks })
      if (modal === 'hr_review')   await api.patch(`/api/hr/invoices/${id}/review`,   { remarks })
      if (modal === 'hr_approve')  await api.patch(`/api/hr/invoices/${id}/approve`,  { remarks })
      if (modal === 'hr_reject')   await api.patch(`/api/hr/invoices/${id}/reject`,   { remarks })
      if (modal === 'comp_verify') await api.patch(`/api/compliance/invoices/${id}/verify`, { remarks })
      if (modal === 'comp_reject') await api.patch(`/api/compliance/invoices/${id}/reject`, { remarks })
      if (modal === 'fin_verify')  await api.patch(`/api/finance/invoices/${id}/verify`,    { remarks })
      if (modal === 'fin_clear')   await api.patch(`/api/finance/invoices/${id}/clear`,     { remarks })
      if (modal === 'fin_reject')  await api.patch(`/api/finance/invoices/${id}/reject`,    { remarks })
      if (modal === 'payment')     await api.patch(`/api/finance/invoices/${id}/payment`,   { utrNumber: utr, paymentDate: payDate })
      toast.success('Done')
      setModal(null); setRemarks(''); setUtr(''); setPayDate('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Action failed')
    } finally { setSaving(false) }
  }

  if (loading)  return <div className="page-header"><h2>Loading...</h2></div>
  if (!invoice) return <div className="alert alert-danger">Invoice not found</div>

  const st       = invoice.status
  const curStage = st?.currentStage ?? 'uploaded'
  const subRole  = user?.subRole
  const role     = user?.role

  const stageLabel = invoice.extractionStatus === 'failed'
    ? 'Parse Failed'
    : (STAGE_LABEL[curStage] ?? curStage)
  const stageColor = invoice.extractionStatus === 'failed' ? '#dc3545' : (STAGE_COLOR[curStage] ?? '#999')

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <div>
            <h2 style={{ margin: 0 }}>
              {invoice.invoiceNumber ?? 'Invoice'}
              <span style={{ marginLeft: 12, fontSize: 12, padding: '4px 12px', borderRadius: 20, background: stageColor + '18', color: stageColor, fontWeight: 600 }}>
                {stageLabel}
              </span>
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
              {invoice.hrPartner?.name} &middot; {PROJECT_LABELS[invoice.project]} &middot; {NATURE_LABELS[invoice.nature]}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {subRole === 'hr_maker' && curStage === 'extracted' && (
            <button className="btn btn-success" onClick={() => { setModal('hr_verify'); setRemarks('') }}>✓ Verify</button>
          )}
          {subRole === 'hr_checker' && curStage === 'hr_maker_verified' && (
            <button className="btn btn-success" onClick={() => { setModal('hr_review'); setRemarks('') }}>✓ Review</button>
          )}
          {subRole === 'hr_approver' && curStage === 'hr_checker_reviewed' && (
            <>
              <button className="btn btn-success" onClick={() => { setModal('hr_approve'); setRemarks('') }}>✓ Approve</button>
              <button className="btn btn-danger"  onClick={() => { setModal('hr_reject');  setRemarks('') }}>✕ Reject</button>
            </>
          )}
          {role === 'compliance_team' && curStage === 'hr_approved' && (
            <>
              <button className="btn btn-success" onClick={() => { setModal('comp_verify'); setRemarks('') }}>✓ Verify</button>
              <button className="btn btn-danger"  onClick={() => { setModal('comp_reject'); setRemarks('') }}>✕ Reject</button>
            </>
          )}
          {subRole === 'finance_maker' && curStage === 'compliance_verified' && (
            <>
              <button className="btn btn-success" onClick={() => { setModal('fin_verify'); setRemarks('') }}>✓ Verify</button>
              <button className="btn btn-danger"  onClick={() => { setModal('fin_reject'); setRemarks('') }}>✕ Reject</button>
            </>
          )}
          {subRole === 'finance_checker' && curStage === 'finance_maker_verified' && (
            <>
              <button className="btn btn-success" onClick={() => { setModal('fin_clear');  setRemarks('') }}>✓ Clear</button>
              <button className="btn btn-danger"  onClick={() => { setModal('fin_reject'); setRemarks('') }}>✕ Reject</button>
            </>
          )}
          {role === 'finance_team' && curStage === 'finance_cleared' && st?.paymentStatus === 'unpaid' && (
            <button className="btn btn-primary" onClick={() => { setModal('payment'); setUtr(''); setPayDate('') }}>₹ Mark Paid</button>
          )}
        </div>
      </div>

      {invoice.extractionStatus === 'failed' && (
        <div className="alert alert-danger" style={{ marginBottom: 14 }}>
          <strong>Extraction failed:</strong> {invoice.extractionError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Invoice Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Invoice Number" value={invoice.invoiceNumber} mono />
              <Field label="Invoice Date"   value={invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN') : null} />
              <Field label="Type"           value={invoice.type === 'credit_note' ? 'Credit Note' : 'Regular'} />
              <Field label="Uploaded"       value={new Date(invoice.createdAt).toLocaleString('en-IN')} />
            </div>
            <Field label="IRN"         value={invoice.irn} mono />
            <Field label="Description" value={invoice.description} />
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Parties</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a56a0', marginBottom: 8 }}>HR PARTNER (Supplier)</div>
                <Field label="GSTIN"   value={invoice.hrPartnerGstin}   mono />
                <Field label="PAN"     value={invoice.hrPartnerPan}     mono />
                <Field label="State"   value={invoice.hrPartnerState} />
                <Field label="Address" value={invoice.hrPartnerAddress} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#28a745', marginBottom: 8 }}>SBOSS (Recipient)</div>
                <Field label="Name"    value={invoice.sbossName} />
                <Field label="GSTIN"   value={invoice.sbossGstin} mono />
                <Field label="PAN"     value={invoice.sbossPan}   mono />
                <Field label="State"   value={invoice.sbossState} />
                <Field label="Address" value={invoice.sbossAddress} />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Amount Breakdown</h3>
            <table style={{ width: '100%', fontSize: 13 }}>
              <tbody>
                {invoice.amountOfService != null && (
                  <tr><td style={{ padding: '5px 0', color: '#666' }}>Amount of Service</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(invoice.amountOfService)}</td></tr>
                )}
                {invoice.serviceCharges != null && (
                  <tr><td style={{ padding: '5px 0', color: '#666' }}>Service Charges</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(invoice.serviceCharges)}</td></tr>
                )}
                <tr style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: '5px 0', fontWeight: 600 }}>Taxable Amount</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{money(invoice.taxableAmount)}</td>
                </tr>
                {invoice.cgstAmount != null && (
                  <tr><td style={{ padding: '5px 0', color: '#666' }}>CGST</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(invoice.cgstAmount)}</td></tr>
                )}
                {invoice.sgstAmount != null && (
                  <tr><td style={{ padding: '5px 0', color: '#666' }}>SGST</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(invoice.sgstAmount)}</td></tr>
                )}
                {invoice.igstAmount != null && (
                  <tr><td style={{ padding: '5px 0', color: '#666' }}>IGST</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(invoice.igstAmount)}</td></tr>
                )}
                {invoice.roundOff != null && (
                  <tr><td style={{ padding: '5px 0', color: '#666' }}>Round Off</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(invoice.roundOff)}</td></tr>
                )}
                <tr style={{ borderTop: '2px solid #1a56a0' }}>
                  <td style={{ padding: '8px 0', fontWeight: 700, fontSize: 14 }}>Invoice Value</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{money(invoice.invoiceValue)}</td>
                </tr>
                {invoice.type !== 'credit_note' && invoice.creditNotes?.length > 0 && (
                  <>
                    {invoice.creditNotes.map(cn => (
                      <tr key={cn.id}>
                        <td style={{ padding: '5px 0', color: '#dc3545', fontSize: 12 }}>
                          CN: {cn.creditNoteNumber ?? '(parsing...)'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#dc3545', fontSize: 12 }}>
                          {cn.creditNoteValue != null ? `−${money(Math.abs(Number(cn.creditNoteValue)))}` : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #28a745' }}>
                      <td style={{ padding: '8px 0', fontWeight: 700, fontSize: 14, color: '#28a745' }}>Effective Payable</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#28a745' }}>{money(invoice.effectiveAmount)}</td>
                    </tr>
                  </>
                )}
                {invoice.shortAmount != null && (
                  <tr><td style={{ padding: '5px 0', color: '#e67e22' }}>Short Amount</td><td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#e67e22' }}>{money(invoice.shortAmount)}</td></tr>
                )}
                {invoice.excessAmount != null && (
                  <tr><td style={{ padding: '5px 0', color: '#e67e22' }}>Excess Amount</td><td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#e67e22' }}>{money(invoice.excessAmount)}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {st?.paymentStatus === 'paid' && (
            <div className="card" style={{ marginBottom: 14, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
              <h3 style={{ marginTop: 0, fontSize: 14, color: '#28a745' }}>✓ Payment Completed</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="UTR Number"   value={st.paymentReferenceId} mono />
                <Field label="Payment Date" value={st.paymentDate ? new Date(st.paymentDate).toLocaleDateString('en-IN') : null} />
                {st.paymentUpdatedBy && <Field label="Marked By" value={`${st.paymentUpdatedBy.name} (${st.paymentUpdatedBy.username})`} />}
              </div>
            </div>
          )}

          {/* Credit note: show original invoice link */}
          {invoice.type === 'credit_note' && (
            <div className="card" style={{ marginBottom: 14, background: '#fff3cd', border: '1px solid #ffc107' }}>
              <h3 style={{ marginTop: 0, fontSize: 14 }}>Credit Note</h3>
              {invoice.originalInvoice ? (
                <div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Original Invoice</div>
                  <a
                    href={`${rolePrefix}/invoices/${invoice.originalInvoice.id}`}
                    style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1a56a0' }}
                  >
                    {invoice.originalInvoice.invoiceNumber}
                  </a>
                  {invoice.originalInvoice.invoiceValue != null && (
                    <span style={{ marginLeft: 12, fontSize: 12, color: '#666' }}>
                      {money(invoice.originalInvoice.invoiceValue)}
                    </span>
                  )}
                  {role === 'super_admin' && (
                    <button
                      className="btn btn-sm"
                      style={{ marginLeft: 12 }}
                      onClick={unlinkCreditNote}
                      disabled={linking}
                    >
                      Unlink
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: '#856404', marginBottom: 8 }}>
                    {invoice.originalInvoiceNumber
                      ? <>Ref: <strong>{invoice.originalInvoiceNumber}</strong> — not yet matched to an invoice in the system.</>
                      : 'Original invoice reference not found in PDF — link manually below.'}
                  </div>
                  {role === 'super_admin' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        style={{ flex: 1, minWidth: 180 }}
                        placeholder="Search by invoice number..."
                        value={linkSearch}
                        onChange={e => { setLinkSearch(e.target.value); searchInvoices(e.target.value) }}
                      />
                      {linkResults.length > 0 && (
                        <div style={{ width: '100%', background: '#fff', border: '1px solid #ddd', borderRadius: 6, marginTop: 4 }}>
                          {linkResults.map(r => (
                            <div
                              key={r.id}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f0f0f0' }}
                              onClick={() => linkCreditNote(r.id)}
                            >
                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.invoiceNumber}</span>
                              <span style={{ marginLeft: 8, color: '#666' }}>{r.hrPartner?.name}</span>
                              {r.invoiceValue && <span style={{ marginLeft: 8, color: '#28a745' }}>{money(r.invoiceValue)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <StageTimeline st={st} />

          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Activity Log</h3>
            {invoice.activities.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>No activity yet</p>}
            {invoice.activities.map(a => (
              <div key={a.id} style={{
                borderLeft: `3px solid ${a.role === 'finance_team' ? '#28a745' : a.role === 'compliance_team' ? '#6f42c1' : a.role === 'vendor' ? '#fd7e14' : '#1a56a0'}`,
                paddingLeft: 12, marginBottom: 12,
              }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{a.action.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{a.user?.name} ({a.user?.username})</div>
                {a.remarks && <div style={{ fontSize: 12, fontStyle: 'italic', color: '#333' }}>"{a.remarks}"</div>}
                <div style={{ fontSize: 11, color: '#999' }}>{new Date(a.createdAt).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        </div>

       <div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    position: 'sticky',
    top: 14
  }}
>
  <div className="card" style={{ padding: 8 }}>
    <iframe
      src={`/api/invoices/${id}/pdf`}
      title="Invoice PDF"
      style={{
        width: '100%',
        height: '85vh',
        border: 'none',
        borderRadius: 6
      }}
    />
  </div>

  {invoice.creditNotes?.map(cn => (
    <div
      key={cn.id}
      className="card"
      style={{ padding: 8 }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 10,
          color: '#dc3545'
        }}
      >
        Credit Note: {cn.creditNoteNumber}
      </h3>

      <iframe
        src={`/api/invoices/credit-notes/${cn.id}/pdf`}
        title={cn.creditNoteNumber}
        style={{
          width: '100%',
          height: '70vh',
          border: 'none',
          borderRadius: 6
        }}
      />
    </div>
  ))}
</div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 440, margin: 0 }}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>
              {modal === 'payment' ? '₹ Mark Payment'
               : (modal.includes('reject') ? '✕ Reject Invoice'
               : '✓ ' + (modal === 'hr_verify' ? 'Verify' : modal === 'hr_review' ? 'Review' : modal === 'hr_approve' ? 'Approve' : modal === 'comp_verify' ? 'Verify (Compliance)' : modal === 'fin_verify' ? 'Verify (Finance Maker)' : 'Clear (Finance Checker)'))}
            </h3>
            {modal !== 'payment' && (
              <div className="form-group">
                <label>Remarks {modal.includes('reject') ? '*' : '(optional)'}</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder={modal.includes('reject') ? 'Reason for rejection is required' : 'Optional remarks...'} />
              </div>
            )}
            {modal === 'payment' && (
              <>
                <div className="form-group">
                  <label>UTR Number *</label>
                  <input value={utr} onChange={e => setUtr(e.target.value)} placeholder="Enter UTR / reference number" />
                </div>
                <div className="form-group">
                  <label>Payment Date *</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn ${modal.includes('reject') ? 'btn-danger' : 'btn-primary'}`}
                onClick={doAction} disabled={saving}>
                {saving ? 'Saving...' : 'Confirm'}
              </button>
              <button className="btn" onClick={() => { setModal(null); setRemarks(''); setUtr(''); setPayDate('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
