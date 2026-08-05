import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

import api from '../../lib/api'
import useAuth from '../../hooks/useAuth'

export default function Profile() {

  const { user, refreshUser } = useAuth()

  const [saving, setSaving] =
    useState(false)

  const [pwForm, setPwForm] =
    useState({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })

    useEffect(() => {
    refreshUser()
  }, [refreshUser])

  async function changePassword(e) {

    e.preventDefault()

    if (
      pwForm.newPassword !==
      pwForm.confirmPassword
    ) {
      return toast.error(
        'Passwords do not match'
      )
    }

    if (
      pwForm.newPassword.length < 6
    ) {
      return toast.error(
        'Password must be at least 6 characters'
      )
    }

    setSaving(true)

    try {

      const { data } =
        await api.post(
          '/api/auth/change-password',
          {
            currentPassword:
              pwForm.currentPassword,
            newPassword:
              pwForm.newPassword
          }
        )

      toast.success(
        data.message
      )

      setPwForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

    } catch (err) {

      toast.error(
        err.response?.data?.message ||
        'Failed to update password'
      )

    } finally {

      setSaving(false)
    }
  }

  function getRoleLabel(role) {

    switch (role) {

      case 'super_admin':
        return 'Super Admin'

      case 'hr_team':
        return 'HR Admin'

      case 'finance_team':
        return 'Finance Admin'

      case 'vendor':
        return 'HR Partner'

      default:
        return role
    }
  }

  function getRoleBadge(role) {

    switch (role) {

      case 'super_admin':
        return 'badge-admin'

      case 'finance_team':
        return 'badge-admin'

      default:
        return 'badge-approved'
    }
  }

  return (

    <div
      style={{
        maxWidth: 700
      }}
    >

      <div className="page-header">

        <div>

          <h2>
            My Profile
          </h2>

          <p>
            Manage your account
          </p>

        </div>

      </div>

      <div
        className="card"
        style={{
          marginBottom: 16
        }}
      >

        <h3
          style={{
            marginBottom: 20
          }}
        >
          Account Details
        </h3>

        <div
          className="grid"
          style={{
            gap: 16
          }}
        >

          <div>

            <label
              className="text-small text-muted"
            >
              Name
            </label>

            <div
              style={{
                fontWeight: 500,
                marginTop: 4
              }}
            >
              {user?.name || '-'}
            </div>

          </div>

          <div>

            <label
              className="text-small text-muted"
            >
              Username
            </label>

            <div
              style={{
                marginTop: 4
              }}
            >
              <code>
                {user?.username || '-'}
              </code>
            </div>

          </div>

          <div>

            <label
              className="text-small text-muted"
            >
              Email
            </label>

            <div
              style={{
                marginTop: 4
              }}
            >
              {user?.email || '-'}
            </div>

          </div>

          <div>

            <label
              className="text-small text-muted"
            >
              Role
            </label>

            <div
              style={{
                marginTop: 4
              }}
            >

              <span
                className={`badge ${getRoleBadge(
                  user?.role
                )}`}
              >
                {getRoleLabel(
                  user?.role
                )}
              </span>

            </div>

          </div>

           <div>

            <label
              className="text-small text-muted"
            >
              Sub Role
            </label>

            <div
              style={{
                marginTop: 4
              }}
            >

              <span
                className={`badge ${getRoleBadge(
                  user?.subRole
                )}`}
              >
                {getRoleLabel(
                  user?.subRole
                )}
              </span>

            </div>

          </div>

          <div>

            <label
              className="text-small text-muted"
            >
              Status
            </label>

            <div
              style={{
                marginTop: 4
              }}
            >

              <span
                className={`badge ${
                  user?.isActive
                    ? 'badge-approved'
                    : 'badge-rejected'
                }`}
              >
                {user?.isActive
                  ? 'Active'
                  : 'Inactive'}
              </span>

            </div>

          </div>

          <div>

            <label
              className="text-small text-muted"
            >
              Joined On
            </label>

            <div
              style={{
                marginTop: 4
              }}
            >

              {user?.createdAt
                ? new Date(
                    user.createdAt
                  ).toLocaleDateString(
                    'en-IN'
                  )
                : '-'}

            </div>

          </div>

        </div>

      </div>

      <div className="card">

        <h3
          style={{
            marginBottom: 20
          }}
        >
          Change Password
        </h3>

        <form
          onSubmit={
            changePassword
          }
        >

          <div className="form-group">

            <label>
              Current Password *
            </label>

            <input
              type="password"
              value={
                pwForm.currentPassword
              }
              onChange={(e) =>
                setPwForm(f => ({
                  ...f,
                  currentPassword:
                    e.target.value
                }))
              }
              required
            />

          </div>

          <div className="form-group">

            <label>
              New Password *
            </label>

            <input
              type="password"
              value={
                pwForm.newPassword
              }
              onChange={(e) =>
                setPwForm(f => ({
                  ...f,
                  newPassword:
                    e.target.value
                }))
              }
              required
            />

          </div>

          <div className="form-group">

            <label>
              Confirm New Password *
            </label>

            <input
              type="password"
              value={
                pwForm.confirmPassword
              }
              onChange={(e) =>
                setPwForm(f => ({
                  ...f,
                  confirmPassword:
                    e.target.value
                }))
              }
              required
            />

          </div>

          <button
            type="submit"
            className="
              btn
              btn-primary
            "
            disabled={saving}
          >

            {saving
              ? <span className="spinner" />
              : 'Update Password'}

          </button>

        </form>

      </div>

    </div>
  )
}