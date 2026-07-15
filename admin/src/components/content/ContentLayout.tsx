import { NavLink, Outlet, Navigate } from 'react-router-dom'

const tabs = [
  { to: '/content/pages', label: 'Страницы' },
  { to: '/content/banners', label: 'Баннеры' },
] as const

export const ContentLayout = () => (
  <div className="content-module">
    <header className="content-header">
      <h2 className="content-title">Контент</h2>
      <nav className="content-tabs" aria-label="Разделы контента">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `content-tab${isActive ? ' content-tab-active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
    <Outlet />
  </div>
)

export const ContentIndexRedirect = () => <Navigate to="pages" replace />
