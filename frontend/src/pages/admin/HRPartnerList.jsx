import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import api from '../../lib/api'
import useAuth from '../../hooks/useAuth'

export default function HrPartnersList() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'super_admin'

  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const [createdPartner, setCreatedPartner] = useState(null)
  const [resetResult, setResetResult] = useState(null)

  const [lastPassword, setLastPassword] = useState('')

  const [form, setForm] = useState({
  name: '',
  pan: ''
})

async function loadPartners() {

  setLoading(true)
  try {
    const { data } = await api.get('/api/hr-partners')

    setPartners(data.partners)
  } catch (err) {
  console.error(err)
} finally {
    setLoading(false)
  }
}

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPartners()
  }, [])

async function createPartner(e) {

  e.preventDefault()
  if (form.pan.length !== 10) {
    toast.error(
      'PAN must be exactly 10 characters'
    )
    return
  }

  setCreating(true)
  try {
    const { data } =
      await api.post('/api/hr-partners', form)
    setCreatedPartner(data.partner)
    setLastPassword(data.credentials.password)

    setForm({
      name: '',
      pan: ''
    })

    loadPartners()
  } catch (err) {
    toast.error(
      err.response?.data?.message ||
      'Failed to create HR Partner'
    )
  } finally {
    setCreating(false)
  }
}

  async function togglePartnerActive(partner) {

  const action =
    partner.isActive
      ? 'deactivate'
      : 'activate'

  if (
    !window.confirm(
      `Are you sure you want to ${action} "${partner.name}"?`
    )
  ) {
    return
  }

  try {

    const { data } =
      await api.patch(
        `/api/hr-partners/${partner.id}/toggle-active`
      )

    toast.success(
      data.message
    )

    loadPartners()

  } catch (err) {

    toast.error(
      err.response?.data?.message ||
      'Failed'
    )
  }
}

async function deletePartner(partner) {

  if (
    !window.confirm(
      `Delete "${partner.name}"?\n\nAll history will remain preserved.`
    )
  ) {
    return
  }

  try {

    const { data } =
      await api.delete(
        `/api/hr-partners/${partner.id}`
      )

    toast.success(
      data.message
    )

    loadPartners()

  } catch (err) {

    toast.error(
      err.response?.data?.message ||
      'Failed'
    )
  }
}

async function resetPartnerPassword(partner) {

  try {

    const { data } =
      await api.post(
        `/api/hr-partners/${partner.id}/reset-password`
      )

    setResetResult(data)

  } catch (err) {

    toast.error(
      err.response?.data?.message ||
      'Failed'
    )
  }
}

  function copyCredentials() {

    if (!createdPartner) return

    navigator.clipboard.writeText(
      `Username: ${createdPartner.username}\nPassword: ${lastPassword}`
    )

    toast.success(
      'Copied to clipboard'
    )
  }

  return (
    <div>

      <div className="page-header">

        <div>
          <h2>
            HR Partner Management
          </h2>

          <p>
            Create and manage HR Partners
          </p>

        </div>

        {isAdmin && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowForm(true)
              setCreatedPartner(null)
            }}
          >
            + Create HR-Partner
          </button>
        )}

      </div>

      <div
        className="card"
        style={{ padding: 0 }}
      >

        <div className="table-wrap">

          <table>

            <thead>

            <tr>
  <th>Company Name</th>
  <th>PAN</th>
  <th>Username</th>
  <th>Status</th>
  <th>Created</th>
  <th>Actions</th>
</tr>

            </thead>

            <tbody>

              {loading && (

                <tr>

                  <td
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      padding: 32
                    }}
                  >
                    <span className="spinner spinner-lg" />
                  </td>

                </tr>

              )}

              {!loading &&
                partners.map(partner => (
                <tr key={partner.id}>

                  <td
                    style={{
                      fontWeight: 500
                    }}
                  >
                    {partner.name}
                  </td>

                 <td className="text-small">
  {partner.pan}
</td>

<td>
  <code
    style={{
      fontSize: 12
    }}
  >
    {partner.username}
  </code>
</td>
                  <td>

                    <span
                      className={`badge ${
                        partner.isActive
                          ? 'badge-approved'
                          : 'badge-rejected'
                      }`}
                    >

                      {partner.isActive
                        ? 'Active'
                        : 'Inactive'}

                    </span>

                  </td>

                  <td
                    className="
                      text-muted
                      text-small
                    "
                  >
                    {new Date(
                      partner.createdAt
                    ).toLocaleDateString(
                      'en-IN'
                    )}
                  </td>

                 <td>

  {partner.isDeleted ? (

    <span
      className="text-muted"
      style={{
        fontSize: 12,
        fontWeight: 500
      }}
    >
      Deleted
    </span>
  ) : isAdmin ? (
    <div
      className="flex gap-8"
    >

      <button
        className="btn btn-sm"
        style={{
          fontSize: 11
        }}
        onClick={() =>
          resetPartnerPassword(partner)
        }
      >
        🔑 Reset
      </button>

      <button
        className="btn btn-sm"
        style={{
          fontSize: 11,
          color:
            partner.isActive
              ? '#e67e00'
              : '#28a745'
        }}
        onClick={() =>
          togglePartnerActive(partner)
        }
      >
        {partner.isActive
          ? 'Deactivate'
          : 'Activate'}
      </button>

      <button
        className="
          btn
          btn-danger
          btn-sm
        "
        style={{
          fontSize: 11
        }}
        onClick={() =>
          deletePartner(partner)
        }
      >
        Delete
      </button>

    </div>

  ) : (
    <span className="text-muted" style={{ fontSize: 12 }}>—</span>
  )}

</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

      {showForm && (

        <div
          className="modal-overlay"
          onClick={() => {
            setShowForm(false)
            setCreatedPartner(null)
          }}
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {!createdPartner ? (

              <>

                <h3>
                  Create New Partner
                </h3>

                <form
                  onSubmit={
                    createPartner
                  }
                >

                  <div className="form-group">

                    <label>
                      Company Name *
                    </label>

                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm(f => ({
                          ...f,
                          name:
                            e.target.value
                        }))
                      }
                      required
                      placeholder="e.g. ABC Pvt. Ltd"
                    />

                  </div>

                 <div className="form-group">

  <label>
    PAN *
  </label>

  <input
  value={form.pan}
  onChange={(e) =>
    setForm(f => ({
      ...f,
      pan: e.target.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10)
    }))
  }
  required
  maxLength={10}
  placeholder="ABCDE1234F"
/>
</div>

                  <div
                    className="flex gap-8"
                    style={{
                      justifyContent:
                        'flex-end',
                      marginTop: 14
                    }}
                  >

                    <button
                      type="button"
                      className="
                        btn btn-sm
                      "
                      onClick={() =>
                        setShowForm(
                          false
                        )
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="
                        btn
                        btn-primary
                        btn-sm
                      "
                      disabled={
                        creating
                      }
                    >

                      {creating
                        ? <span className="spinner" />
                        : 'Create HR Partner'}

                    </button>

                  </div>

                </form>

              </>

            ) : (

              <>

                <h3>
                  ✓ HR Partner Created
                </h3>

                <div
                  style={{
                    background:
                      '#f0fdf4',
                    border:
                      '1px solid #c3e6cb',
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 14
                  }}
                >

                  <div
                    style={{
                      fontFamily:
                        'monospace',
                      fontSize: 13,
                      lineHeight: 2
                    }}
                  >

                    <div>

                      Username:

                      <strong>
                        {' '}
                        {
                          createdPartner.username
                        }
                      </strong>

                    </div>

                    <div>

                      Password:

                      <strong>
                        {' '}
                        {
                          lastPassword
                        }
                      </strong>

                    </div>

                  </div>

                </div>

                <div
                  className="flex gap-8"
                  style={{
                    justifyContent:
                      'flex-end'
                  }}
                >

                  <button
                    className="
                      btn
                      btn-primary
                      btn-sm
                    "
                    onClick={
                      copyCredentials
                    }
                  >
                    📋 Copy
                  </button>

                  <button
                    className="
                      btn btn-sm
                    "
                    onClick={() => {
                      setShowForm(false)
                      setCreatedPartner(
                        null
                      )
                    }}
                  >
                    Close
                  </button>

                </div>

              </>

            )}

          </div>

        </div>

           )}

      {resetResult && (

        <div
          className="modal-overlay"
          onClick={() =>
            setResetResult(null)
          }
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h3>
              ✓ Password Reset
            </h3>

            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #c3e6cb',
                borderRadius: 8,
                padding: 14,
                marginBottom: 14
              }}
            >

              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 2
                }}
              >

                <div>

                  Username:

                  <strong>
                    {' '}
                    {resetResult.credentials.username}
                  </strong>

                </div>

                <div>

                  New Password:

                  <strong>
                    {' '}
                    {resetResult.credentials.password}
                  </strong>

                </div>

              </div>

            </div>

            <div
              className="flex gap-8"
              style={{
                justifyContent:
                  'flex-end'
              }}
            >

              <button
                className="
                  btn
                  btn-primary
                  btn-sm
                "
                onClick={() => {

                  navigator.clipboard.writeText(
                    `Username: ${resetResult.credentials.username}\nPassword: ${resetResult.credentials.password}`
                  )

                  toast.success(
                    'Copied to clipboard'
                  )
                }}
              >
                📋 Copy
              </button>

              <button
                className="
                  btn btn-sm
                "
                onClick={() =>
                  setResetResult(null)
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}