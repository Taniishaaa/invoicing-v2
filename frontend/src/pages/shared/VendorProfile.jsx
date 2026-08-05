import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

import api from '../../lib/api'
import useAuth from '../../hooks/useAuth'

export default function VendorProfile() {

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
        'Password updated successfully'
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

        <div className="field-row">

          <div className="field-label">
            Company Name
          </div>

          <div className="field-value">
            {user?.name || '—'}
          </div>

        </div>

        <div className="field-row">

          <div className="field-label">
            PAN
          </div>

          <div className="field-value">
            {user?.pan || '—'}
          </div>

        </div>

        <div className="field-row">

          <div className="field-label">
            Username
          </div>

          <div
            className="field-value"
            style={{
              fontFamily:
                'monospace'
            }}
          >
            {user?.username || '—'}
          </div>

        </div>

        <div className="field-row">

          <div className="field-label">
            Status
          </div>

          <div className="field-value">

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

        <div className="field-row">

          <div className="field-label">
            Joined On
          </div>

          <div className="field-value">
            {user?.createdAt
              ? new Date(
                  user.createdAt
                ).toLocaleDateString(
                  'en-IN'
                )
              : '—'}
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
              Confirm Password *
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