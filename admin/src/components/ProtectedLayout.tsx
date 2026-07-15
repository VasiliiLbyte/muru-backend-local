import {
  FileText,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingBag,
} from 'lucide-react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'

import { Badge, Button } from './ui'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard, end: true },
  { to: '/catalog', label: 'Каталог и разделы', icon: FolderTree, end: false },
  { to: '/orders', label: 'Заказы', icon: ShoppingBag, end: false },
  { to: '/content', label: 'Контент', icon: FileText, end: false },
] as const

export const ProtectedLayout = () => {
  const navigate = useNavigate()
  const { admin, loading, logout } = useAuth()

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="muru-spinner" aria-hidden />
        <p className="loading-screen__text">Загрузка...</p>
      </main>
    )
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
        <div className="sidebar-brand">
          <h1 className="sidebar-brand__title">MURU</h1>
          <p className="sidebar-brand__subtitle">Admin</p>
        </div>

        <nav className="sidebar-nav" aria-label="Основная навигация">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
              }
            >
              <Icon className="sidebar-link__icon" aria-hidden />
              {label}
            </NavLink>
          ))}

          <div className="sidebar-muted">
            <Settings className="sidebar-muted__icon" aria-hidden />
            <span>Настройки</span>
            <Badge variant="neutral">скоро</Badge>
          </div>
        </nav>

        <div className="sidebar-footer">
          <Button variant="ghost" fullWidth onClick={onLogout}>
            <LogOut size={18} aria-hidden />
            Выйти
          </Button>
        </div>
      </aside>

      <main className="content muru-rise">
        <Outlet />
      </main>
    </div>
  )
}
