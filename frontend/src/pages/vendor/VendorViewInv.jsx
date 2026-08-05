import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'

const PROJECT_LABELS = { fos:'FOS', atm_mitra:'ATM Mitra', csp_mitra:'CSP Mitra', seva_sarathi:'Seva Sarathi', collections:'Collections' }
const NATURE_LABELS  = { salary:'Salary', reimbursement:'Reimbursement', fnf:'FNF', bgv:'BGV', sourcing:'Sourcing' }

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

export default function VendorViewInv() {
  const { id }      = useParams()
  const navigate    = useNavigate()

  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const r = await api.get(`/api/invoices/${id}`)
      setInvoice(r.data.invoice)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to load invoice')
    } finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  if (loading)  return <div className="page-header"><h2>Loading...</h2></div>
  if (!invoice) return <div className="alert alert-danger">Invoice not found</div>

 const st = invoice.status

 const totalCreditNotes =
  invoice.creditNoteTotal ?? 0

const effectiveAmount =
  invoice.effectiveAmount ??
  invoice.invoiceValue

let stageLabel = 'Processing'
let stageColor = '#856404'

if (invoice.extractionStatus === 'completed') {
  stageLabel = 'Parsed Successfully'
  stageColor = '#28a745'
}

if (invoice.extractionStatus === 'failed') {
  stageLabel = 'Parse Failed'
  stageColor = '#dc3545'
}

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
  <h3 style={{ marginTop: 0, fontSize: 14 }}>
    Invoice Status
  </h3>

  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '0 16px'
    }}
  >
    <Field
      label="Parser Status"
      value={
        invoice.extractionStatus === 'completed'
          ? 'Parsed Successfully'
          : invoice.extractionStatus === 'failed'
          ? 'Parse Failed'
          : 'Processing'
      }
    />

    <Field
      label="Payment Status"
      value={
        st?.paymentStatus === 'paid'
          ? 'Paid'
          : 'Pending'
      }
    />
  </div>
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
  <td
    style={{
      padding: '8px 0',
      fontWeight: 700,
      fontSize: 14
    }}
  >
    Invoice Value
  </td>

  <td
    style={{
      textAlign: 'right',
      fontFamily: 'monospace',
      fontWeight: 700,
      fontSize: 14
    }}
  >
    {money(invoice.invoiceValue)}
  </td>
</tr>

{
  invoice.creditNotes?.map(cn => (
    <tr key={cn.id}>
      <td
        style={{
          padding:'5px 0',
          color:'#dc3545'
        }}
      >
        Credit Note ({cn.creditNoteNumber})
      </td>

      <td
        style={{
          textAlign:'right',
          color:'#dc3545',
          fontFamily:'monospace'
        }}
      >
        - {money(cn.creditNoteValue)}
      </td>
    </tr>
  ))
}

{
  totalCreditNotes > 0 && (
    <tr
      style={{
        borderTop:'2px solid #28a745'
      }}
    >
      <td
        style={{
          padding:'8px 0',
          fontWeight:700,
          fontSize:15
        }}
      >
        Net Payable Amount
      </td>

      <td
        style={{
          textAlign:'right',
          fontFamily:'monospace',
          fontWeight:700,
          fontSize:15,
          color:'#28a745'
        }}
      >
        {money(effectiveAmount)}
      </td>
    </tr>
    
  )
}
{
  invoice.creditNotes?.length > 0 && (
    <tr
      style={{
        borderTop: '2px solid #28a745'
      }}
    >
      <td
        style={{
          padding: '8px 0',
          fontWeight: 700,
          fontSize: 15,
          color: '#28a745'
        }}
      >
        Net Payable Amount
      </td>

      <td
        style={{
          textAlign: 'right',
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: 15,
          color: '#28a745'
        }}
      >
        {money(invoice.effectiveAmount)}
      </td>
    </tr>
  )
}

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
              </div>
            </div>
          )}

        </div>

       <div
  style={{
    display:'flex',
    flexDirection:'column',
    gap:14,
    position:'sticky',
    top:14
  }}
>

  <div className="card" style={{ padding:8 }}>
    <h3
      style={{
        marginTop:0,
        marginBottom:10
      }}
    >
      Invoice PDF
    </h3>

    <iframe
      src={`/api/invoices/${id}/pdf`}
      title="Invoice PDF"
      style={{
        width:'100%',
        height:'85vh',
        border:'none',
        borderRadius:6
      }}
    />
  </div>

  {
    invoice.creditNotes?.map(cn => (
      <div
        key={cn.id}
        className="card"
        style={{ padding:8 }}
      >
        <h3
          style={{
            marginTop:0,
            marginBottom:10,
            color:'#dc3545'
          }}
        >
          Credit Note: {cn.creditNoteNumber}
        </h3>

        <iframe
          src={`/api/invoices/credit-notes/${cn.id}/pdf`}
          title={cn.creditNoteNumber}
          style={{
            width:'100%',
            height:'65vh',
            border:'none',
            borderRadius:6
          }}
        />
      </div>
    ))
  }

</div>
      </div>

    </div>
  )
}
