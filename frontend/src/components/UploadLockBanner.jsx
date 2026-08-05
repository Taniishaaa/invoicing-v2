import { useEffect, useState } from 'react'
import api from '../lib/api'
import useAuth from '../hooks/useAuth'

export default function UploadLockBanner() {
  const { user } = useAuth()
  const [lock,   setLock]   = useState(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const canControl = ['super_admin', 'hr_team', 'finance_team'].includes(user?.role)

  useEffect(() => {
    api.get('/api/system/upload-lock')
      .then(r => setLock(r.data.lock))
      .catch(console.error)
  }, [])

  async function toggle() {
    setSaving(true)
    try {
      const r = await api.post('/api/system/upload-lock', {
        isLocked: !lock.isLocked,
        reason:   !lock.isLocked ? reason : null,
      })
      setLock(r.data.lock)
      setReason('')
    } catch (err) {
      alert(err.response?.data?.message ?? 'Failed to update lock')
    } finally { setSaving(false) }
  }

  if (!lock) return null

  return (
    <div>
      {canControl && (
        <div style={{
          background: lock.isLocked ? '#fff3cd' : '#d4edda',
          border: `1px solid ${lock.isLocked ? '#ffc107' : '#c3e6cb'}`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {lock.isLocked ? '🔒 Uploads Locked' : '🔓 Uploads Open'}
            </span>
            {lock.isLocked && lock.reason && (
              <span style={{ fontSize: 12, color: '#856404', marginLeft: 8 }}>— {lock.reason}</span>
            )}
            {lock.lockedByName && (
              <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>
                (last changed by {lock.lockedByName})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!lock.isLocked && (
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for locking (optional)"
                style={{ padding: '5px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12, width: 220 }}
              />
            )}
            <button
              className={`btn btn-sm ${lock.isLocked ? 'btn-success' : 'btn-danger'}`}
              onClick={toggle} disabled={saving}>
              {saving ? '...' : lock.isLocked ? 'Unlock Uploads' : 'Lock Uploads'}
            </button>
          </div>
        </div>
      )}

      {!canControl && lock.isLocked && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          🔒 <strong>Uploads are currently locked.</strong>
          {lock.reason ? ` Reason: ${lock.reason}.` : ''} Please contact your administrator.
        </div>
      )}
    </div>
  )
}
