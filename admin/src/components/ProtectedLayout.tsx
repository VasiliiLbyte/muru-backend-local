import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export const ProtectedLayout = () => {
  const navigate = useNavigate()
  const { admin, loading, logout } = useAuth()

  if (loading) {
    return <main className="loading-screen">Загрузка...</main>
  }

  if (!admin) {
    return <Navigate to="/login" replace />
  }

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <h1 className="sidebar-title">MURU Admin</h1>
        <nav className="sidebar-nav">
          <Link className="sidebar-link" to="/">
            Дашборд
          </Link>
          <span className="sidebar-muted">Товары</span>
          <span className="sidebar-muted">Заказы</span>
          <span className="sidebar-muted">Контент</span>
          <span className="sidebar-muted">Настройки</span>
        </nav>
        <button type="button" className="secondary-button" onClick={onLogout}>
          Выйти
        </button>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
