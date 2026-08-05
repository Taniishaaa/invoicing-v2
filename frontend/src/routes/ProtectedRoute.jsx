import {
  Navigate
} from 'react-router-dom'

import useAuth from '../hooks/useAuth'

export default function ProtectedRoute({
  children,
  roles
}) {

  const {
    user,
    loading
  } = useAuth()

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

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  if (
    roles &&
    !roles.includes(user.role)
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return children
}