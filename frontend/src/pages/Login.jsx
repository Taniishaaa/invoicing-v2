import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import api from '../lib/api'
import logo from '../assets/sboss_logo.png'
import useAuth from '../hooks/useAuth'

export default function LoginPage() {

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuth()

  const navigate = useNavigate()

  async function handleLogin(e) {

    e.preventDefault()

    setLoading(true)

    try {

      const { data } = await api.post(
        '/api/auth/login',
        {
          username,
          password
        }
      )

      const user = data.user
      setUser(user)
      toast.success('Login successful')

      switch (user.role) {

  case 'vendor':
    navigate('/vendor')
    break

  case 'hr_team':
    navigate('/hr')
    break

  case 'compliance_team':
    navigate('/compliance')
    break

  case 'finance_team':
    navigate('/finance')
    break

  case 'super_admin':
    navigate('/admin')
    break

  default:
    toast.error('Invalid user role')
    navigate('/login')
}
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        'Invalid username or password'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">

      <div className="login-card">

        <div
          style={{
            textAlign: 'center',
            marginBottom: 20
          }}
        >
          <img
            src={logo}
            alt="SBOSS"
            style={{
              height: 56,
              objectFit: 'contain'
            }}
          />
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#999',
            marginBottom: 24
          }}
        >
          SBOSS Invoice Intelligence System
        </p>

        <form onSubmit={handleLogin}>

          <div className="form-group">

            <label>Username</label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />

          </div>

          <div className="form-group">

            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />

          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              marginTop: 8,
              justifyContent: 'center'
            }}
            disabled={loading}
          >

            {
              loading
                ? <span className="spinner" />
                : 'Sign In'
            }

          </button>
        </form>
      </div>
    </div>
  )
}