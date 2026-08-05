import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import logo from '../assets/sboss_logo.png'
import useAuth from '../hooks/useAuth'
import UploadLockBanner from '../components/UploadLockBanner'

export default function VendorLayout() {

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
            to="/vendor"
            end
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/vendor/invoices"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            My Invoices
          </NavLink>


          <NavLink
            to="/vendor/upload"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Upload Invoices
          </NavLink>

          <NavLink
            to="/vendor/upload-credit-notes"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Upload Credit Notes
          </NavLink>

          <NavLink
            to="/vendor/profile"
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
            HR Partner
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
