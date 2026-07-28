import { Outlet } from 'react-router-dom'

import { CatalogMetaProvider } from '../../context/CatalogMetaContext'

/** Shared catalog meta for sections tabs and products routes. */
export const CatalogRootLayout = () => (
  <CatalogMetaProvider>
    <Outlet />
  </CatalogMetaProvider>
)
