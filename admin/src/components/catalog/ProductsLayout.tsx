import { Outlet } from 'react-router-dom'

import { useCatalogMetaContext } from '../../context/CatalogMetaContext'
import { CatalogReadOnlyBanner } from './CatalogReadOnlyBanner'

/** Products module shell: meta loading/error + read-only banner, no catalog tabs. */
export const ProductsLayout = () => {
  const { readOnly, loading, error } = useCatalogMetaContext()

  return (
    <div className="content-module">
      {loading ? <p className="muted-text">Загрузка режима каталога...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {readOnly ? <CatalogReadOnlyBanner /> : null}
      <Outlet />
    </div>
  )
}
