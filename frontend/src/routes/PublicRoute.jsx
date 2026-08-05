import { Navigate } from 'react-router-dom'

import useAuth from '../hooks/useAuth'

export default function PublicRoute({
  children
}) {

  const {user, loading} = useAuth()

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        Loading...
      </div>
    )
  }

  if (user) {

    switch (user.role) {

      case 'super_admin':
        return (
          <Navigate
            to="/admin"
            replace
          />
        )

      case 'hr_team':
        return (
          <Navigate
            to="/hr"
            replace
          />
        )

      case 'finance_team':
        return (
          <Navigate
            to="/finance"
            replace
          />
        )

      case 'vendor':
        return (
          <Navigate
            to="/vendor"
            replace
          />
        )

      default:
        break
    }
  }

  return children
}