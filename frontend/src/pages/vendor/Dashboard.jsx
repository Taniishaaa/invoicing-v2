import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

const PROJECT_LABELS = {
  fos: 'FOS',
  atm_mitra: 'ATM Mitra',
  csp_mitra: 'CSP Mitra',
  seva_sarathi: 'Seva Sarathi',
  collections: 'Collections'
}

const NATURE_LABELS = {
  salary: 'Salary',
  reimbursement: 'Reimbursement',
  fnf: 'FNF',
  bgv: 'BGV',
  sourcing: 'Sourcing'
}

export default function VendorDashboard() {
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/vendor/dashboard')
      .then(res => setStats(res.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-header">
        <h2>Loading...</h2>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="alert alert-danger">
        Failed to load dashboard
      </div>
    )
  }

  const CARDS = [
    {
      label: 'Uploaded Bills',
      value: stats.uploaded,
      color: '#1a56a0',
      path: '/vendor/invoices'
    },
    {
      label: 'Rejected Bills',
      value: stats.failed,
      color: '#dc3545',
      path: '/vendor/invoices?extractionStatus=failed'
    },
    {
      label: 'Payment Pending',
      value: stats.paymentPending,
      color: '#fd7e14',
      path: '/vendor/invoices?paymentStatus=unpaid'
    },
    {
      label: 'Paid & Closed',
      value: stats.paid,
      color: '#28a745',
      path: '/vendor/invoices?paymentStatus=paid'
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 24
        }}
      >
        {CARDS.map(card => (
          <div
            key={card.label}
            className="stat-card"
            onClick={() => navigate(card.path)}
            style={{
              cursor: 'pointer',
              borderLeft: `4px solid ${card.color}`
            }}
          >
            <div className="stat-label">
              {card.label}
            </div>

            <div
              className="stat-value"
              style={{
                color: card.color
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="card-title" style={{ marginBottom: 8 }}>
  Recent Uploads
</div>

<div className="card" style={{ padding: 0 }}>
  <div className="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Nature</th>
          <th>Files</th>
          <th>Date</th>
        </tr>
      </thead>

      <tbody>
        {stats.recentBatches.length === 0 && (
          <tr>
            <td
              colSpan={4}
              style={{
                textAlign: 'center',
                padding: 24,
                color: '#999'
              }}
            >
              No uploads yet
            </td>
          </tr>
        )}

        {stats.recentBatches.map(batch => (
          <tr key={batch.id}>
            <td>
              {PROJECT_LABELS[batch.project]}
            </td>

            <td style={{ textTransform: 'capitalize' }}>
              {NATURE_LABELS[batch.nature]}
            </td>

            <td>
              {batch.processedFiles + batch.failedFiles} / {batch.totalFiles}
            </td>

            <td
              style={{
                color: '#999',
                fontSize: 12
              }}
            >
              {new Date(batch.createdAt).toLocaleDateString('en-IN')}
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