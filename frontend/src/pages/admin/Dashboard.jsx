import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import ExportExcel from '../../components/ExportExcel'

const PROJECT_LABELS = {
  fos: 'FOS', atm_mitra: 'ATM Mitra', csp_mitra: 'CSP Mitra',
  seva_sarathi: 'Seva Sarathi', collections: 'Collections'
}

function money(v) {
  if (!v) return '₹0'
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)} Cr`
  if (v >= 100000)   return `₹${(v/100000).toFixed(2)} L`
  return `₹${Number(v).toLocaleString('en-IN')}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats,   setStats]   = useState(null)
  const [funnel,  setFunnel]  = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/dashboard'),
      api.get('/api/admin/funnel'),
    ])
      .then(([d, f]) => { setStats(d.data.stats); setFunnel(f.data.funnel) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-header"><h2>Loading...</h2></div>
  if (!stats || !funnel) return <div className="alert alert-danger">Failed to load dashboard</div>

  const FUNNEL = [
    { key: 'hrMakerPending',     label: 'HR Maker Review',      color: '#004085', filter: { currentStage: 'extracted' } },
    { key: 'hrCheckerPending',   label: 'HR Checker Review',    color: '#0069b4', filter: { currentStage: 'hr_maker_verified' } },
    { key: 'hrApproverPending',  label: 'HR Approver Review',   color: '#1a56a0', filter: { currentStage: 'hr_checker_reviewed' } },
    { key: 'compliancePending',  label: 'Compliance Review',    color: '#6f42c1', filter: { currentStage: 'hr_approved' } },
    { key: 'financeMakerPending',label: 'Finance Maker Review', color: '#fd7e14', filter: { currentStage: 'compliance_verified' } },
    { key: 'financeCheckerPending', label: 'Finance Checker',   color: '#e06b00', filter: { currentStage: 'finance_maker_verified' } },
    { key: 'paymentPending',     label: 'Payment Pending',      color: '#d63031', filter: { currentStage: 'finance_cleared' } },
    { key: 'paid',               label: 'Paid & Closed',        color: '#28a745', filter: { currentStage: 'paid' } },
    { key: 'rejected',           label: 'Rejected',             color: '#999',    filter: { currentStage: 'rejected' } },
  ]

  function drill(filter) {
    const params = new URLSearchParams(filter).toString()
    navigate(`/admin/invoices?${params}`)
  }

  return (
    <div>
     <div
  className="page-header"
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  }}
>

  <div>
    <h2>Dashboard</h2>
  </div>

  <ExportExcel />

</div>

      {/* Invoice Pipeline Funnel */}
      <div className="card-title" style={{ marginBottom: 8 }}>Invoice Pipeline</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 22 }}>
        {FUNNEL.map(s => (
          <div
            key={s.key}
            className="stat-card"
            onClick={() => drill(s.filter)}
            style={{ cursor: 'pointer', borderLeft: `4px solid ${s.color}` }}
          >
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{funnel[s.key]?.count ?? 0}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{money(funnel[s.key]?.value)}</div>
          </div>
        ))}
      </div>

      {/* HR Partners */}
      <div className="card-title" style={{ marginBottom: 8 }}>HR Partners</div>
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" onClick={() => navigate('/admin/hr-partners')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.partners.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value" style={{ color: '#28a745' }}>{stats.partners.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactive</div>
          <div className="stat-value" style={{ color: '#999' }}>{stats.partners.inactive}</div>
        </div>
      </div>

      {/* Recent Batches */}
      <div className="card-title" style={{ marginBottom: 8 }}>Recent Uploads</div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>HR Partner</th>
                <th>Project</th>
                <th>Nature</th>
                <th>Files</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBatches.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#999' }}>No uploads yet</td></tr>
              )}
              {stats.recentBatches.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.hrPartner}</td>
                  <td>{PROJECT_LABELS[b.project] ?? b.project}</td>
                  <td style={{ textTransform: 'capitalize' }}>{b.nature}</td>
                  <td>{b.invoiceCount} / {b.totalFiles}</td>
                  <td style={{ color: '#999', fontSize: 12 }}>
                    {new Date(b.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
