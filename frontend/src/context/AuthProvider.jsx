import {
  useEffect,
  useState, useCallback
} from 'react'

import api from '../lib/api'

import AuthContext from './AuthContext'

export default function AuthProvider({
  children
}) {

  const [user, setUser] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {

    async function loadUser() {

      try {
        const { data } =
          await api.get(
            '/api/auth/me'
          )
        setUser(data.user)

      } catch {
        setUser(null)

      } finally {
        setLoading(false)

      }
    }
    loadUser()
  }, [])

  const logout = async () => {
      await api.post('/api/auth/logout')
    setUser(null)
  }

const refreshUser = useCallback(
  async () => {

    try {

      const { data } =
        await api.get('/api/auth/me')

      setUser(data.user)

    } catch {

      setUser(null)

    }
  },
  []
)

  return (
    <AuthContext.Provider
  value={{
    user,
    setUser,
    loading,
    logout,
    refreshUser
  }}
>
      {children}
    </AuthContext.Provider>
  )
}