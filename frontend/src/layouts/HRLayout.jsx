import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import logo from '../assets/sboss_logo.png'
import useAuth from '../hooks/useAuth'
import UploadLockBanner from '../components/UploadLockBanner'

export default function HrLayout() {

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

          <p
            style={{
              fontSize: 10,
              color: '#999',
              marginTop: 2
            }}
          >
            Invoice Intelligence
          </p>

        </div>

        <nav className="sidebar-nav">

          <NavLink
            to="/hr"
            end
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/hr/invoices"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Invoices
          </NavLink>

          <NavLink
            to="/hr/partners"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            HR Partners
          </NavLink>

          <NavLink
            to="/hr/profile"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Profile
          </NavLink>

        </nav>

        <div className="sidebar-footer">

          <div className="user-name">
            {user?.username}
          </div>

          <div className="user-role">
            HR Admin
          </div>

          <button
            className="logout-btn"
            onClick={handleLogout}
          >
            Sign Out
          </button>

        </div>

      </aside>

      <main className="main">
        <UploadLockBanner />
        <Outlet />
      </main>

    </div>
  )
}
