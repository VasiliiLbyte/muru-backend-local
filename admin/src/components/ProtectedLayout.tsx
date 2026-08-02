import {
  FileText,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  Warehouse,
} from 'lucide-react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Button } from './ui'
import { useAuth } from '../context/AuthContext'

export const ProtectedLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, loading, logout } = useAuth()
  const { pathname } = location

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

  const catalogActive =
    pathname.startsWith('/catalog') && !pathname.startsWith('/catalog/products')
  const productsActive = pathname.startsWith('/catalog/products')

  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1 className="sidebar-brand__title">MURU</h1>
          <p className="sidebar-brand__subtitle">Admin</p>
        </div>

        <nav className="sidebar-nav" aria-label="Основная навигация">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
          >
            <LayoutDashboard className="sidebar-link__icon" aria-hidden />
            Дашборд
          </NavLink>

          <NavLink
            to="/catalog"
            className={() => `sidebar-link${catalogActive ? ' sidebar-link--active' : ''}`}
          >
            <FolderTree className="sidebar-link__icon" aria-hidden />
            Каталог и разделы
          </NavLink>

          <NavLink
            to="/catalog/products"
            className={() => `sidebar-link${productsActive ? ' sidebar-link--active' : ''}`}
          >
            <Package className="sidebar-link__icon" aria-hidden />
            Товары
          </NavLink>

          <NavLink
            to="/orders"
            className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
          >
            <ShoppingBag className="sidebar-link__icon" aria-hidden />
            Заказы
          </NavLink>

          <NavLink
            to="/stock/movements"
            className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
          >
            <Warehouse className="sidebar-link__icon" aria-hidden />
            Склад
          </NavLink>

          <NavLink
            to="/content"
            className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
          >
            <FileText className="sidebar-link__icon" aria-hidden />
            Контент
          </NavLink>

          {admin.role === 'owner' ? (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
              }
            >
              <Settings className="sidebar-link__icon" aria-hidden />
              Настройки
            </NavLink>
          ) : null}
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
