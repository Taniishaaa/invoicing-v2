import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import api from '../../lib/api'

export default function AdminList() {

  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const [createdAdmin, setCreatedAdmin] = useState(null)
  const [resetResult, setResetResult] = useState(null)

  const [lastPassword, setLastPassword] = useState('')

  const [form, setForm] = useState({
  name: '',
  email: '',
  password: '',
  role: 'hr_team',
  subRole: 'hr_maker'
})

  async function loadAdmins() {

    setLoading(true)
    try {

      const { data } =
        await api.get(
          '/api/admin/users'
        )

      setAdmins(data.admins)

    } catch {

      toast.error(
        'Failed to load admins'
      )

    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAdmins()
  }, [])

  async function createAdmin(e) {

    e.preventDefault()
    setCreating(true)

    try {
      const password = form.password
      const { data } =
        await api.post(
          '/api/admin/users',
          form
        )

      setCreatedAdmin(data.admin)
      setLastPassword(password)
      setForm({
  name: '',
  email: '',
  password: '',
  role: 'hr_team',
  subRole: 'hr_maker'
})

      loadAdmins()

    } catch (err) {

      toast.error(
        err.response?.data?.message ||
        'Failed to create admin'
      )

    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(admin) {

  const action =
    admin.isActive
      ? 'deactivate'
      : 'activate'

  if (
    !window.confirm(
      `Are you sure you want to ${action} "${admin.name}"?`
    )
  ) {
    return
  }

  try {

    const { data } =
      await api.patch(
        `/api/admin/users/${admin.id}/toggle-active`
      )

    toast.success(
      data.message
    )

    loadAdmins()

  } catch (err) {

    toast.error(
      err.response?.data?.message ||
      'Failed'
    )
  }
}

async function deleteAdmin(admin) {

  if (
    !window.confirm(
      `Delete "${admin.name}"?\n\nAll history will remain preserved.`
    )
  ) {
    return
  }

  try {

    const { data } =
      await api.delete(
        `/api/admin/users/${admin.id}`
      )

    toast.success(
      data.message
    )

    loadAdmins()

  } catch (err) {

    toast.error(
      err.response?.data?.message ||
      'Failed'
    )
  }
}

async function resetPassword(admin) {

  try {

    const { data } =
      await api.post(
        `/api/admin/users/${admin.id}/reset-password`
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

    if (!createdAdmin) return

    navigator.clipboard.writeText(
      `Username: ${createdAdmin.username}\nPassword: ${lastPassword}`
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
            Admin Management
          </h2>

          <p>Create and manage HR, Compliance and Finance admins</p>

        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setShowForm(true)
            setCreatedAdmin(null)
          }}
        >
          + Create Admin
        </button>

      </div>

      <div
        className="card"
        style={{ padding: 0 }}
      >

        <div className="table-wrap">

          <table>

            <thead>

              <tr>

                <th>Name</th>

                <th>Username</th>

                <th>Email</th>

                <th>Role</th>
                <th>Sub Role</th>

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
                admins.map(admin => (

                <tr key={admin.id}>

                  <td
                    style={{
                      fontWeight: 500
                    }}
                  >
                    {admin.name}
                  </td>

                  <td>
                    <code
                      style={{
                        fontSize: 12
                      }}
                    >
                      {admin.username}
                    </code>
                  </td>

                  <td
                    className="text-small"
                  >
                    {admin.email}
                  </td>

                 <td>

  <span
    className={`badge ${
  admin.role === 'hr_team'
    ? 'badge-approved'
    : admin.role === 'compliance_team'
      ? 'badge-processing'
      : 'badge-admin'
}`}
  >

    {
  admin.role === 'hr_team'
    ? 'HR Admin'
    : admin.role === 'compliance_team'
      ? 'Compliance Admin'
      : 'Finance Admin'
}

  </span>

</td>

<td>
  <span
    className="badge badge-admin"
  >
    {admin.subRole
      ?.replaceAll('_', ' ')
      .replace(
        /\b\w/g,
        c => c.toUpperCase()
      )}
  </span>
</td>

                  <td>

                    <span
                      className={`badge ${
                        admin.isActive
                          ? 'badge-approved'
                          : 'badge-rejected'
                      }`}
                    >

                      {admin.isActive
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
                      admin.createdAt
                    ).toLocaleDateString(
                      'en-IN'
                    )}
                  </td>

                 <td>

  {admin.isDeleted ? (

    <span
      className="text-muted"
      style={{
        fontSize: 12,
        fontWeight: 500
      }}
    >
      Deleted
    </span>

  ) : (

    <div
      className="flex gap-8"
    >

      <button
        className="btn btn-sm"
        style={{
          fontSize: 11
        }}
        onClick={() =>
          resetPassword(admin)
        }
      >
        🔑 Reset
      </button>

      <button
        className="btn btn-sm"
        style={{
          fontSize: 11,
          color:
            admin.isActive
              ? '#e67e00'
              : '#28a745'
        }}
        onClick={() =>
          toggleActive(admin)
        }
      >
        {admin.isActive
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
          deleteAdmin(admin)
        }
      >
        Delete
      </button>

    </div>

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
            setCreatedAdmin(null)
          }}
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {!createdAdmin ? (

              <>

                <h3>
                  Create New Admin
                </h3>

                <form
                  onSubmit={
                    createAdmin
                  }
                >

                  <div className="form-group">

                    <label>
                      Full Name *
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
                      placeholder="e.g. Rahul Sharma"
                    />

                  </div>

                  <div className="form-group">

                    <label>
                      Email *
                    </label>

                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm(f => ({
                          ...f,
                          email:
                            e.target.value
                        }))
                      }
                      required
                      placeholder="name@sboss.com"
                    />

                  </div>

                  <div className="two-col">

                    <div className="form-group">

                      <label>
                        Role *
                      </label>

                      <select
                        value={form.role}
                     onChange={(e) => {

  const role = e.target.value

  setForm(f => ({
    ...f,
    role,
    subRole:
      role === 'hr_team'
        ? 'hr_maker'
        : role === 'compliance_team'
          ? 'compliance'
          : 'finance_maker'
  }))
}}
                      >

                        <option
                          value="hr_team"
                        >
                          HR Admin
                        </option>

                        <option value="compliance_team">
  Compliance Admin
</option>

                        <option
                          value="finance_team"
                        >
                          Finance Admin
                        </option>

                      </select>

                    </div>

                    <div className="form-group">

  <label>
    Sub Role *
  </label>

  <select
    value={form.subRole}
    onChange={(e) =>
      setForm(f => ({
        ...f,
        subRole: e.target.value
      }))
    }
  >

{form.role === 'hr_team' ? (

  <>
    <option value="hr_maker">
      HR Maker
    </option>

    <option value="hr_checker">
      HR Checker
    </option>

    <option value="hr_approver">
      HR Approver
    </option>
  </>

) : form.role === 'compliance_team' ? (

  <option value="compliance">
    Compliance
  </option>

) : (

  <>
    <option value="finance_maker">
      Finance Maker
    </option>

    <option value="finance_checker">
      Finance Checker
    </option>
  </>

)}

  </select>

</div>

                    <div className="form-group">

                      <label>
                        Password *
                      </label>

                      <input
                        type="password"
                        value={
                          form.password
                        }
                        onChange={(e) =>
                          setForm(f => ({
                            ...f,
                            password:
                              e.target.value
                          }))
                        }
                        required
                      />

                    </div>

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
                        : 'Create Admin'}

                    </button>

                  </div>

                </form>

              </>

            ) : (

              <>

                <h3>
                  ✓ Admin Created
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
                          createdAdmin.username
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
                      setCreatedAdmin(
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