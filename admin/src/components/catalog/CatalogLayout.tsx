import { Outlet, Navigate } from 'react-router-dom'

import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { Tabs, TabsList, TabsTrigger } from '../ui'
import { CatalogReadOnlyBanner } from './CatalogReadOnlyBanner'

const tabs = [
  { to: '/catalog/sections', label: 'Разделы' },
  { to: '/catalog/characteristics', label: 'Характеристики' },
  { to: '/catalog/import-export', label: 'Импорт / Экспорт' },
] as const

export const CatalogLayout = () => {
  const { readOnly, loading, error } = useCatalogMetaContext()

  return (
    <div className="content-module">
      <header className="content-header">
        <h2 className="content-title">Каталог и разделы</h2>
        <Tabs>
          <TabsList aria-label="Разделы каталога">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.to} to={tab.to}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      {loading ? <p className="muted-text">Загрузка режима каталога...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {readOnly ? <CatalogReadOnlyBanner /> : null}

      <Outlet />
    </div>
  )
}

export const CatalogIndexRedirect = () => <Navigate to="sections" replace />
