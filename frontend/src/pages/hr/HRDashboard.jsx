import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import ExportExcel from '../../components/ExportExcel'

const PROJECT_LABELS = {
  fos: 'FOS', atm_mitra: 'ATM Mitra', csp_mitra: 'CSP Mitra',
  seva_sarathi: 'Seva Sarathi', collections: 'Collections'
}

const NATURE_LABELS = {
  salary: 'Salary',
  reimbursement: 'Reimbursement',
  fnf: 'FNF',
  bgv: 'BGV',
  sourcing: 'Sourcing'
}

const DASHBOARD_STATUS = {
  pending_approval: 'badge badge-processing',
  approved: 'badge badge-approved',
  rejected: 'badge badge-rejected',
  partially_approved: 'badge badge-pending_review',
  failed: 'badge badge-rejected'
}

function batchRef(batch) {
  const d = new Date(batch.createdAt)

  const date =
    `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`

  return `B-${date}-${batch.id.slice(-6).toUpperCase()}`
}

export default function HRDashboard() {
  const navigate = useNavigate()

const [stats, setStats] = useState(null)
const [loading, setLoading] = useState(true)

const [detail, setDetail] = useState(null)
const [detailLoading, setDetailLoading] = useState(false)

const [logInvoice, setLogInvoice] = useState(null)
const [log, setLog] = useState([])

  useEffect(() => {
    api.get('/api/hr/dashboard')
      .then(r => setStats(r.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function openDetail(batchId) {
  setDetailLoading(true)

  try {
    const r =
      await api.get(`/api/batches/${batchId}`)

    setDetail(r.data.batch)
  }
  catch {
    setDetail(null)
  }
  finally {
    setDetailLoading(false)
  }
}

async function openLog(inv) {
  setLogInvoice(inv)

  try {
    const r =
      await api.get(
        `/api/hr/invoices/${inv.id}/log`
      )

    setLog(r.data.log ?? [])
  }
  catch {
    setLog([])
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

    const url = URL.createObjectURL(res.data)

    const a = document.createElement("a")

    a.href = url
    a.download = `Batch_${batchId}.xlsx`

    a.click()

    URL.revokeObjectURL(url)

  } catch {

    alert("Failed to download excel")

  }

}

  if (loading) return <div className="page-header"><h2>Loading...</h2></div>
  if (!stats)  return <div className="alert alert-danger">Failed to load dashboard</div>

  return (
    <div>
    <div className="page-header">

  <div>
    <h2>HR Dashboard</h2>
  </div>

  <ExportExcel />

</div>
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
  {
    label:'Pending Approval',
    value:stats.pendingApproval,
    color:'#856404'
  },

  {
    label:'Approved',
    value:stats.approved,
    color:'#28a745'
  },

  {
    label:'Rejected',
    value:stats.totalRejected,
    color:'#dc3545'
  }
].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card-title" style={{ marginBottom: 8 }}>
  Invoice Batches
</div>

<div className="card" style={{ padding: 0 }}>
  <div className="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Batch Number</th>
          <th>Vendor</th>
          <th>Project</th>
          <th>Nature</th>
          <th>Status</th>
          <th>Upload Date</th>
        </tr>
      </thead>

      <tbody>

        {stats.batches.length === 0 && (
          <tr>
            <td
              colSpan={6}
              style={{
                textAlign:'center',
                padding:24,
                color:'#999'
              }}
            >
              No batches found
            </td>
          </tr>
        )}

        {stats.batches.map(batch => (
          <tr
  key={batch.id}
  style={{ cursor:'pointer' }}
  onClick={() => openDetail(batch.id)}
>
            <td
              style={{
                fontFamily:'monospace',
                fontWeight:600,
                color:'#1a56a0'
              }}
            >
              {batchRef(batch)}
            </td>

            <td>
              {batch.hrPartner}
            </td>

            <td>
              {PROJECT_LABELS[batch.project] ?? batch.project}
            </td>

            <td>
              {NATURE_LABELS[batch.nature] ?? batch.nature}
            </td>

            <td>
              <span
                className={
                  DASHBOARD_STATUS[batch.status]
                }
              >
                {batch.status.replace(/_/g,' ')}
              </span>
            </td>

            <td
              style={{
                color:'#999',
                fontSize:12
              }}
            >
              {new Date(
                batch.createdAt
              ).toLocaleDateString('en-IN')}
            </td>
          </tr>
        ))}

      </tbody>
    </table>
  </div>
</div>
      
{detail && (
 
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 1000
    }}
  >
    <div
      style={{
        width: 720,
        height: '100vh',
        background: '#fff',
        padding: 24,
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 20
        }}
      >

         <div>
                <h3 style={{ margin: 0 }}>{detail._loading ? 'Loading...' : batchRef(detail)}</h3>
                {!detail._loading && <span style={{ fontSize:11, color:'#999' }}>{detail.id}</span>}
              </div>
        <h3>
          {detail._loading
            ? 'Loading...'
            : detail.batchNumber}
        </h3>

        <div
  style={{
    display: "flex",
    gap: 8
  }}
>

  <button
    className="btn btn-sm"
    onClick={() =>
      downloadBatchExcel(detail.id)
    }
  >
    ↓ Excel
  </button>

  <button
    className="btn btn-sm"
    onClick={() => setDetail(null)}
  >
    ✕ Close
  </button>

</div>
      </div>

      {!detailLoading && (
        <>
          <div
            className="card"
            style={{
              marginBottom: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12
            }}
          >
            <div>
              <span className="text-muted">
                Vendor
              </span>
              <br />
              {detail.hrPartner?.name}
            </div>

            <div>
              <span className="text-muted">
                Project
              </span>
              <br />
              {PROJECT_LABELS[detail.project]}
            </div>

            <div>
              <span className="text-muted">
                Nature
              </span>
              <br />
              {detail.nature}
            </div>

            <div>
              <span className="text-muted">
                Upload Date
              </span>
              <br />
              {new Date(
                detail.createdAt
              ).toLocaleString('en-IN')}
            </div>
          </div>

          <h4>
            Invoices
            ({detail.invoices?.length ?? 0})
          </h4>

          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {(detail.invoices ?? []).map(inv => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNumber}</td>

                  <td>
                    {inv.invoiceDate
                      ? new Date(
                          inv.invoiceDate
                        ).toLocaleDateString('en-IN')
                      : '—'}
                  </td>

                  <td>
                    ₹{Number(
                      inv.invoiceValue ?? 0
                    ).toLocaleString('en-IN')}
                  </td>

                  <td>
                    {inv.status?.currentStage}
                  </td>

                  <td>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6
                      }}
                    >
                      <button
                        className="btn btn-sm"
                        onClick={() => openLog(inv)}
                      >
                        Log
                      </button>

                      <button
                        className="btn btn-sm"
                        onClick={() =>
                          navigate(
                            `/hr/invoices/${inv.id}`
                          )
                        }
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  </div>
)}

          {logInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ width: 400, height: '100vh', background: '#fff', padding: 20, overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>HR Activity Log</h3>
              <button className="btn btn-sm" onClick={() => { setLogInvoice(null); setLog([]) }}>✕ Close</button>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>Invoice: {logInvoice.invoiceNumber ?? logInvoice.id}</div>
            {log.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>No HR activity yet</p>}
            {log.map(entry => (
              <div key={entry.id} style={{ borderLeft: '3px solid #1a56a0', paddingLeft: 12, marginBottom: 14 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{entry.action.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{entry.user?.name} ({entry.user?.username})</div>
                {entry.remarks && <div style={{ fontSize: 12, color: '#333', marginTop: 4, fontStyle: 'italic' }}>"{entry.remarks}"</div>}
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{new Date(entry.createdAt).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
