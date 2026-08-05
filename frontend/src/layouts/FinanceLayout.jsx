import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import logo from '../assets/sboss_logo.png'
import useAuth from '../hooks/useAuth'

export default function FinanceLayout() {

  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">

          <img
            src={logo}
            alt="SBOSS"
            style={{
              width: '100%',
              maxWidth: 140,
              objectFit: 'contain',
              marginBottom: 4
            }}
          />

          <p style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
            Invoice Intelligence
          </p>

        </div>

        <nav className="sidebar-nav">

          <NavLink
            to="/finance"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/finance/invoices"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Invoices
          </NavLink>

          <NavLink
            to="/finance/payment-upload"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Payment Upload
          </NavLink>

          <NavLink
            to="/finance/profile"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Profile
          </NavLink>

        </nav>

        <div className="sidebar-footer">

          <div className="user-name">{user?.username}</div>
          <div className="user-role">Finance</div>

          <button className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>

        </div>

      </aside>

      <main className="main">
        <Outlet />
      </main>

    </div>
  )
}
