import { NavLink, Outlet, Navigate } from 'react-router-dom'

import { CatalogMetaProvider, useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { CatalogReadOnlyBanner } from './CatalogReadOnlyBanner'

const tabs = [
  { to: '/catalog/sections', label: 'Разделы' },
  { to: '/catalog/products', label: 'Товары' },
  { to: '/catalog/characteristics', label: 'Характеристики' },
  { to: '/catalog/import-export', label: 'Импорт / Экспорт' },
] as const

const CatalogLayoutInner = () => {
  const { readOnly, loading, error } = useCatalogMetaContext()

  return (
    <div className="content-module">
      <header className="content-header">
        <h2 className="content-title">Каталог и разделы</h2>
        <nav className="content-tabs" aria-label="Разделы каталога">
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

      {loading ? <p className="muted-text">Загрузка режима каталога...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {readOnly ? <CatalogReadOnlyBanner /> : null}

      <Outlet />
    </div>
  )
}

export const CatalogLayout = () => (
  <CatalogMetaProvider>
    <CatalogLayoutInner />
  </CatalogMetaProvider>
)

export const CatalogIndexRedirect = () => <Navigate to="sections" replace />
